local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local VinRoute = ReplicatedStorage:FindFirstChild("VinRoute") or Instance.new("Folder")
VinRoute.Name = "VinRoute"
VinRoute.Parent = ReplicatedStorage

local Remotes = VinRoute:FindFirstChild("Remotes") or Instance.new("Folder")
Remotes.Name = "Remotes"
Remotes.Parent = VinRoute

local function remote(name)
	local event = Remotes:FindFirstChild(name)
	if not event then
		event = Instance.new("RemoteEvent")
		event.Name = name
		event.Parent = Remotes
	end
	return event
end

local RollDiceRequest = remote("RollDiceRequest")
local MoveRequest = remote("MoveRequest")
local BuildRequest = remote("BuildRequest")
local EndTurnRequest = remote("EndTurnRequest")
local KnowledgeChallengeRequest = remote("KnowledgeChallengeRequest")
local ClientStateUpdate = remote("ClientStateUpdate")
local OpenKnowledgeChallenge = remote("OpenKnowledgeChallenge")
local ChallengeResult = remote("ChallengeResult")

local GameState = require(script.Parent:WaitForChild("GameState"))
local TurnService = require(script.Parent:WaitForChild("TurnService"))
local MovementService = require(script.Parent:WaitForChild("MovementService"))
local BuildingService = require(script.Parent:WaitForChild("BuildingService"))
local KnowledgeService = require(script.Parent:WaitForChild("KnowledgeService"))
local AssetValueService = require(script.Parent:WaitForChild("AssetValueService"))

local state = GameState.new("Standard")
local pendingChallenges = {}

local function broadcast()
	local public = state:GetPublicState()
	if state.status == "Running" and state.phase == "Move" then
		local current = state:GetCurrentPlayer()
		if current then
			public.moveOptions = MovementService.GetNextSteps(current)
		end
	end
	ClientStateUpdate:FireAllClients(public)
end

local function tryStart()
	if state.status == "Waiting" and state:CanStart() then
		state:Start()
		AssetValueService.CalculateAll(state)
	end
	broadcast()
end

Players.PlayerAdded:Connect(function(player)
	state:AddPlayer(player)
	tryStart()
end)

for _, player in ipairs(Players:GetPlayers()) do
	state:AddPlayer(player)
end
tryStart()

Players.PlayerRemoving:Connect(function(player)
	state:RemovePlayer(player)
	broadcast()
end)

local function requestMove(player, regionId)
	if state.status ~= "Running" or state.phase ~= "Move" then
		return
	end
	if not state:IsCurrentPlayer(player) then
		return
	end

	local playerState = state:GetCurrentPlayer()

	local allowed = false
	for _, optionId in ipairs(MovementService.GetNextSteps(playerState)) do
		if optionId == regionId then
			allowed = true
			break
		end
	end
	if not allowed then
		return
	end

	local fromRegionId = playerState.position
	local ok = MovementService.ResolveArrival(state, playerState, regionId)
	if ok then
		playerState.lastPosition = fromRegionId
		state.dice = math.max(0, (state.dice or 0) - 1)
		if state.dice <= 0 then
			playerState.lastPosition = nil
			state.phase = "Build"
		end
		broadcast()
	end
end

_G.VinRouteServerMove = requestMove

RollDiceRequest.OnServerEvent:Connect(function(player)
	local ok = TurnService.RollDice(state, player)
	if ok then
		broadcast()
	end
end)

MoveRequest.OnServerEvent:Connect(function(player, regionId)
	requestMove(player, regionId)
end)

BuildRequest.OnServerEvent:Connect(function(player, buildingType)
	if state.status ~= "Running" or state.phase ~= "Build" then
		return
	end
	if not state:IsCurrentPlayer(player) then
		return
	end

	local playerState = state:GetCurrentPlayer()
	BuildingService.Build(state, playerState, playerState.position, buildingType)
	AssetValueService.CalculateAll(state)
	broadcast()
end)

KnowledgeChallengeRequest.OnServerEvent:Connect(function(player, payload)
	if state.status ~= "Running" then
		return
	end
	if not state:IsCurrentPlayer(player) then
		return
	end

	local playerState = state:GetCurrentPlayer()

	if payload and payload.action == "Start" then
		local challenge = KnowledgeService.PickChallenge()
		pendingChallenges[player.UserId] = challenge.id
		OpenKnowledgeChallenge:FireClient(player, {
			id = challenge.id,
			question = challenge.question,
			choices = challenge.choices,
		})
		return
	end

	if payload and payload.action == "Answer" then
		local challengeId = pendingChallenges[player.UserId]
		if not challengeId then
			return
		end

		pendingChallenges[player.UserId] = nil
		local ok, result = KnowledgeService.ResolveAnswer(state, playerState, challengeId, payload.answer)
		if ok then
			AssetValueService.CalculateAll(state)
			ChallengeResult:FireClient(player, result)
			broadcast()
		end
	end
end)

EndTurnRequest.OnServerEvent:Connect(function(player)
	if state.status ~= "Running" then
		return
	end
	if not state:IsCurrentPlayer(player) then
		return
	end

	local ranking = TurnService.EndTurn(state)
	if ranking then
		ClientStateUpdate:FireAllClients(state:GetPublicState(), ranking)
	else
		broadcast()
	end
end)

task.delay(3, function()
	if state.status == "Waiting" then
		broadcast()
	end
end)
