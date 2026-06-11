local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Shared")
local BuildingData = require(Shared:WaitForChild("BuildingData"))
local RegionData = require(Shared:WaitForChild("RegionData"))

local ResourceService = require(script.Parent:WaitForChild("ResourceService"))

local BuildingService = {}

local function copyCost(cost)
	local copied = {}
	for key, value in pairs(cost) do
		copied[key] = value
	end
	return copied
end

function BuildingService.GetAdjustedCost(playerState, region, buildingType)
	local definition = BuildingData.Types[buildingType]
	if not definition then
		return nil
	end

	local cost = copyCost(definition.cost)

	if playerState.buildDiscount and playerState.buildDiscount > 0 then
		for resourceName, amount in pairs(cost) do
			if amount > 0 then
				cost[resourceName] = math.max(0, amount - 1)
				break
			end
		end
	end

	if region.specialEffect == "WorkshopDiscount" and buildingType == "Workshop" then
		cost.Gold = math.max(0, (cost.Gold or 0) - 1)
	end

	if region.specialEffect == "CellarDiscount" and buildingType == "Cellar" then
		cost.Crystal = math.max(0, (cost.Crystal or 0) - 1)
	end

	return cost
end

function BuildingService.CanBuild(state, playerState, regionId, buildingType)
	local region = RegionData.ById[regionId]
	local boardRegion = state.board[regionId]
	local definition = BuildingData.Types[buildingType]

	if not region or not boardRegion or not definition then
		return false, "Unknown building or region"
	end

	if playerState.position ~= regionId then
		return false, "You must be on the region"
	end

	if not playerState.discovered[regionId] then
		return false, "Region must be discovered first"
	end

	if boardRegion.buildings[buildingType] then
		return false, "Already built"
	end

	if buildingType == "Workshop" and not boardRegion.buildings.Vineyard then
		return false, "Workshop requires a 畑"
	end

	if buildingType == "Cellar" and not boardRegion.buildings.Workshop then
		return false, "Cellar requires a 工房"
	end

	local cost = BuildingService.GetAdjustedCost(playerState, region, buildingType)
	if not ResourceService.CanPay(playerState.resources, cost) then
		return false, "Not enough resources"
	end

	return true, nil, cost
end

function BuildingService.Build(state, playerState, regionId, buildingType)
	local ok, reason, cost = BuildingService.CanBuild(state, playerState, regionId, buildingType)
	if not ok then
		return false, reason
	end

	ResourceService.Pay(playerState.resources, cost)
	if playerState.buildDiscount and playerState.buildDiscount > 0 then
		playerState.buildDiscount -= 1
	end

	state.board[regionId].buildings[buildingType] = {
		type = buildingType,
		ownerUserId = playerState.userId,
	}

	table.insert(playerState.buildings, {
		type = buildingType,
		regionId = regionId,
	})

	local region = RegionData.ById[regionId]
	local definition = BuildingData.Types[buildingType]
	state:AddLog(playerState.name .. " built " .. definition.name .. " at " .. region.name .. ".")

	return true
end

return BuildingService

