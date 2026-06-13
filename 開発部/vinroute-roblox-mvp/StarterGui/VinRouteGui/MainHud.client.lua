local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local VinRoute = ReplicatedStorage:WaitForChild("VinRoute")
local Remotes = VinRoute:WaitForChild("Remotes")

local RollDiceRequest = Remotes:WaitForChild("RollDiceRequest")
local MoveRequest = Remotes:WaitForChild("MoveRequest")
local BuildRequest = Remotes:WaitForChild("BuildRequest")
local EndTurnRequest = Remotes:WaitForChild("EndTurnRequest")
local KnowledgeChallengeRequest = Remotes:WaitForChild("KnowledgeChallengeRequest")
local ClientStateUpdate = Remotes:WaitForChild("ClientStateUpdate")

local Shared = VinRoute:WaitForChild("Shared")
local RegionData = require(Shared:WaitForChild("RegionData"))
local BuildingData = require(Shared:WaitForChild("BuildingData"))

local gui = Instance.new("ScreenGui")
gui.Name = "VinRouteHud"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local root = Instance.new("Frame")
root.Size = UDim2.fromScale(1, 1)
root.BackgroundTransparency = 1
root.Parent = gui

local left = Instance.new("Frame")
left.Size = UDim2.fromOffset(260, 360)
left.Position = UDim2.fromOffset(12, 12)
left.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
left.BackgroundTransparency = 0.08
left.Parent = root

local status = Instance.new("TextLabel")
status.Size = UDim2.new(1, -16, 0, 120)
status.Position = UDim2.fromOffset(8, 8)
status.BackgroundTransparency = 1
status.TextColor3 = Color3.fromRGB(245, 235, 215)
status.TextXAlignment = Enum.TextXAlignment.Left
status.TextYAlignment = Enum.TextYAlignment.Top
status.TextWrapped = true
status.Font = Enum.Font.Gotham
status.TextSize = 14
status.Parent = left

local resources = Instance.new("TextLabel")
resources.Size = UDim2.new(1, -16, 0, 110)
resources.Position = UDim2.fromOffset(8, 132)
resources.BackgroundTransparency = 1
resources.TextColor3 = Color3.fromRGB(220, 205, 170)
resources.TextXAlignment = Enum.TextXAlignment.Left
resources.TextYAlignment = Enum.TextYAlignment.Top
resources.TextWrapped = true
resources.Font = Enum.Font.Gotham
resources.TextSize = 13
resources.Parent = left

local actions = Instance.new("Frame")
actions.Size = UDim2.new(1, -16, 0, 100)
actions.Position = UDim2.fromOffset(8, 250)
actions.BackgroundTransparency = 1
actions.Parent = left

local function makeButton(text, x, y, w)
	local button = Instance.new("TextButton")
	button.Size = UDim2.fromOffset(w or 116, 30)
	button.Position = UDim2.fromOffset(x, y)
	button.Text = text
	button.BackgroundColor3 = Color3.fromRGB(85, 54, 32)
	button.TextColor3 = Color3.fromRGB(255, 245, 225)
	button.Font = Enum.Font.GothamBold
	button.TextSize = 12
	button.Parent = actions
	return button
end

local rollButton = makeButton("Roll", 0, 0)
local challengeButton = makeButton("Knowledge", 124, 0)
local vineyardButton = makeButton("畑", 0, 36, 74)
local workshopButton = makeButton("工房", 82, 36, 74)
local cellarButton = makeButton("セラー", 164, 36, 74)
local endButton = makeButton("End Turn", 0, 72, 238)

local right = Instance.new("Frame")
right.Size = UDim2.fromOffset(320, 440)
right.Position = UDim2.new(1, -332, 0, 12)
right.BackgroundColor3 = Color3.fromRGB(20, 18, 16)
right.BackgroundTransparency = 0.08
right.Parent = root

local dex = Instance.new("TextLabel")
dex.Size = UDim2.new(1, -16, 0, 210)
dex.Position = UDim2.fromOffset(8, 8)
dex.BackgroundTransparency = 1
dex.TextColor3 = Color3.fromRGB(245, 235, 215)
dex.TextXAlignment = Enum.TextXAlignment.Left
dex.TextYAlignment = Enum.TextYAlignment.Top
dex.TextWrapped = true
dex.Font = Enum.Font.Gotham
dex.TextSize = 12
dex.Parent = right

local logLabel = Instance.new("TextLabel")
logLabel.Size = UDim2.new(1, -16, 0, 210)
logLabel.Position = UDim2.fromOffset(8, 222)
logLabel.BackgroundTransparency = 1
logLabel.TextColor3 = Color3.fromRGB(205, 195, 175)
logLabel.TextXAlignment = Enum.TextXAlignment.Left
logLabel.TextYAlignment = Enum.TextYAlignment.Top
logLabel.TextWrapped = true
logLabel.Font = Enum.Font.Gotham
logLabel.TextSize = 12
logLabel.Parent = right

local currentState = nil

local function getLocalState()
	if not currentState then
		return nil
	end
	for _, p in ipairs(currentState.players or {}) do
		if p.userId == player.UserId then
			return p
		end
	end
	return nil
end

local function formatResources(resourceTable)
	local parts = {}
	for _, key in ipairs({ "Grape", "Knowledge", "Gold", "Crystal" }) do
		table.insert(parts, key .. ": " .. tostring(resourceTable[key] or 0))
	end
	return table.concat(parts, "\n")
end

local function updateHud(state)
	currentState = state
	local localState = getLocalState()
	local currentName = "Waiting"
	for _, p in ipairs(state.players or {}) do
		if p.userId == state.currentUserId then
			currentName = p.name
		end
	end

	status.Text = "VinRoute Roblox MVP\nMode: " .. tostring(state.mode) .. "\nSeason: " .. tostring(state.season) .. "/" .. tostring(state.maxSeasons) .. "\nPhase: " .. tostring(state.phase) .. "\nTurn: " .. currentName .. "\n残りマス: " .. tostring(state.dice or 0)

	if localState then
		resources.Text = "Resources\n" .. formatResources(localState.resources) .. "\nAsset: " .. tostring(localState.assetValue or 0)

		local discovered = {}
		for regionId in pairs(localState.discovered or {}) do
			local region = RegionData.ById[regionId]
			if region then
				table.insert(discovered, region.name .. " / " .. region.country)
			end
		end
		table.sort(discovered)
		dex.Text = "Region Dex\n" .. (#discovered > 0 and table.concat(discovered, "\n") or "No discoveries yet.")
	else
		resources.Text = "Waiting for game state."
		dex.Text = "Region Dex"
	end

	local logs = {}
	for index, entry in ipairs(state.log or {}) do
		if index > 10 then
			break
		end
		table.insert(logs, entry.text)
	end
	logLabel.Text = "Market / Turn Log\n" .. table.concat(logs, "\n")

	local isMyTurn = state.currentUserId == player.UserId
	rollButton.Active = isMyTurn and state.phase == "Roll"
	challengeButton.Active = isMyTurn and state.phase == "Build"
	endButton.Active = isMyTurn and state.phase == "Build"
end

rollButton.MouseButton1Click:Connect(function()
	RollDiceRequest:FireServer()
end)

challengeButton.MouseButton1Click:Connect(function()
	KnowledgeChallengeRequest:FireServer({ action = "Start" })
end)

vineyardButton.MouseButton1Click:Connect(function()
	BuildRequest:FireServer("Vineyard")
end)

workshopButton.MouseButton1Click:Connect(function()
	BuildRequest:FireServer("Workshop")
end)

cellarButton.MouseButton1Click:Connect(function()
	BuildRequest:FireServer("Cellar")
end)

endButton.MouseButton1Click:Connect(function()
	EndTurnRequest:FireServer()
end)

ClientStateUpdate.OnClientEvent:Connect(function(state)
	updateHud(state)
end)

for _, region in ipairs(RegionData.List) do
	local regionButton = Instance.new("TextButton")
	regionButton.Name = region.id
	regionButton.Size = UDim2.fromOffset(1, 1)
	regionButton.Visible = false
	regionButton.Parent = gui
	regionButton.MouseButton1Click:Connect(function()
		MoveRequest:FireServer(region.id)
	end)
end

_G.VinRouteMoveToRegion = function(regionId)
	MoveRequest:FireServer(regionId)
end

