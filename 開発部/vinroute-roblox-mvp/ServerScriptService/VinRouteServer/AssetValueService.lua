local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Shared")
local GameConstants = require(Shared:WaitForChild("GameConstants"))
local RegionData = require(Shared:WaitForChild("RegionData"))
local BuildingData = require(Shared:WaitForChild("BuildingData"))

local MarketService = require(script.Parent:WaitForChild("MarketService"))

local AssetValueService = {}

function AssetValueService.GetRegionMarketBonus(state, region)
	local bonus = 0

	for _, active in ipairs(state.activeMarketEvents) do
		local event = MarketService.GetEventById(active.id)
		if event and MarketService.RegionMatchesEvent(region, event) then
			bonus += active.valueBonus or 0
		end
	end

	return bonus
end

function AssetValueService.CalculatePlayer(state, playerState)
	local total = 0

	for resourceName, amount in pairs(playerState.resources) do
		total += amount * (GameConstants.ResourceValues[resourceName] or 0)
	end

	for regionId in pairs(playerState.discovered) do
		local region = RegionData.ById[regionId]
		if region then
			total += region.baseValue
			total += AssetValueService.GetRegionMarketBonus(state, region)

			if region.specialEffect == "CrystalValueBonus" then
				total += (playerState.resources.Crystal or 0)
			end
		end
	end

	for _, building in ipairs(playerState.buildings) do
		local definition = BuildingData.Types[building.type]
		if definition then
			total += definition.assetValue
		end

		local region = RegionData.ById[building.regionId]
		if region and building.type == "Cellar" then
			total += 3
			if region.specialEffect == "CellarValueBonus" then
				total += 1
			end
		end

		if building.type == "Workshop" then
			total += 3
		end
	end

	playerState.assetValue = total
	return total
end

function AssetValueService.CalculateAll(state)
	local ranking = {}

	for _, userId in ipairs(state.playerOrder) do
		local playerState = state.players[userId]
		if playerState then
			table.insert(ranking, {
				userId = userId,
				name = playerState.name,
				assetValue = AssetValueService.CalculatePlayer(state, playerState),
			})
		end
	end

	table.sort(ranking, function(a, b)
		return a.assetValue > b.assetValue
	end)

	return ranking
end

return AssetValueService

