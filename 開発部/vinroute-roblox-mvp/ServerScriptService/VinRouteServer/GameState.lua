local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Shared")
local GameConstants = require(Shared:WaitForChild("GameConstants"))
local RegionData = require(Shared:WaitForChild("RegionData"))

local GameState = {}
GameState.__index = GameState

local function copyResources(resources)
	local copied = {}
	for key, value in pairs(resources) do
		copied[key] = value
	end
	return copied
end

function GameState.new(modeName)
	local mode = GameConstants.Modes[modeName] or GameConstants.Modes[GameConstants.DefaultMode]

	return setmetatable({
		mode = mode,
		status = "Waiting",
		players = {},
		playerOrder = {},
		currentPlayerIndex = 1,
		season = 1,
		roundInSeason = 1,
		turnNumber = 1,
		phase = "Waiting",
		dice = 0,
		activeMarketEvents = {},
		nextMarketEventId = nil,
		log = {},
		board = {},
	}, GameState)
end

function GameState:SetupBoard()
	self.board = {}
	for _, region in ipairs(RegionData.List) do
		self.board[region.id] = {
			id = region.id,
			buildings = {},
			discoveredBy = {},
		}
	end
end

function GameState:AddPlayer(player)
	if self.players[player.UserId] then
		return false
	end

	if #self.playerOrder >= GameConstants.MaxPlayers then
		return false
	end

	local startRegion = RegionData.List[(#self.playerOrder % #RegionData.List) + 1]
	self.players[player.UserId] = {
		userId = player.UserId,
		name = player.DisplayName,
		position = startRegion.id,
		resources = copyResources(GameConstants.StartingResources),
		discovered = {},
		buildings = {},
		marketInfoCards = {},
		buildDiscount = 0,
		priceProtection = 0,
		assetValue = 0,
		connected = true,
	}
	table.insert(self.playerOrder, player.UserId)

	return true
end

function GameState:RemovePlayer(player)
	local record = self.players[player.UserId]
	if record then
		record.connected = false
	end
end

function GameState:CanStart()
	return #self.playerOrder >= GameConstants.MinPlayers
end

function GameState:Start()
	self:SetupBoard()
	self.status = "Running"
	self.phase = "Roll"
	self.currentPlayerIndex = 1
	self.season = 1
	self.roundInSeason = 1
	self.turnNumber = 1
	self:AddLog("VinRoute MVP started in " .. self.mode.label .. " mode.")
end

function GameState:GetCurrentUserId()
	return self.playerOrder[self.currentPlayerIndex]
end

function GameState:GetCurrentPlayer()
	local userId = self:GetCurrentUserId()
	if not userId then
		return nil
	end
	return self.players[userId]
end

function GameState:IsCurrentPlayer(player)
	return self:GetCurrentUserId() == player.UserId
end

function GameState:AddLog(message)
	table.insert(self.log, 1, {
		text = message,
		turn = self.turnNumber,
		season = self.season,
	})

	while #self.log > 40 do
		table.remove(self.log)
	end
end

function GameState:AdvanceTurn()
	self.currentPlayerIndex += 1

	if self.currentPlayerIndex > #self.playerOrder then
		self.currentPlayerIndex = 1
		self.roundInSeason += 1
	end

	if self.roundInSeason > self.mode.turnsPerPlayerPerSeason then
		self.roundInSeason = 1
		self.season += 1
	end

	self.turnNumber += 1
	self.phase = "Roll"
	self.dice = 0
end

function GameState:IsFinished()
	return self.season > self.mode.seasons
end

function GameState:GetPublicState()
	local publicPlayers = {}

	for _, userId in ipairs(self.playerOrder) do
		local playerState = self.players[userId]
		if playerState then
			table.insert(publicPlayers, {
				userId = playerState.userId,
				name = playerState.name,
				position = playerState.position,
				resources = playerState.resources,
				discovered = playerState.discovered,
				buildings = playerState.buildings,
				marketInfoCards = playerState.marketInfoCards,
				assetValue = playerState.assetValue,
			})
		end
	end

	return {
		status = self.status,
		mode = self.mode.label,
		season = self.season,
		maxSeasons = self.mode.seasons,
		roundInSeason = self.roundInSeason,
		currentUserId = self:GetCurrentUserId(),
		phase = self.phase,
		dice = self.dice,
		players = publicPlayers,
		board = self.board,
		activeMarketEvents = self.activeMarketEvents,
		nextMarketEventId = self.nextMarketEventId,
		log = self.log,
	}
end

return GameState

