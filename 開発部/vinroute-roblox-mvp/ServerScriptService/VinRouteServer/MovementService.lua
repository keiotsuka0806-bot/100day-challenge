local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Shared")
local RegionData = require(Shared:WaitForChild("RegionData"))

local ResourceService = require(script.Parent:WaitForChild("ResourceService"))

local MovementService = {}

function MovementService.GetReachable(regionId)
	local region = RegionData.ById[regionId]
	if not region then
		return {}
	end
	return region.adjacent
end

-- 桃鉄ルール: 来た道(lastPosition)には戻れない。
-- ただし行き止まりで他に道が無いときだけ、引き返しを許可する。
function MovementService.GetNextSteps(playerState)
	local region = RegionData.ById[playerState.position]
	if not region then
		return {}
	end

	local options = {}
	for _, adjacentId in ipairs(region.adjacent) do
		if adjacentId ~= playerState.lastPosition then
			table.insert(options, adjacentId)
		end
	end

	if #options == 0 then
		for _, adjacentId in ipairs(region.adjacent) do
			table.insert(options, adjacentId)
		end
	end

	return options
end

function MovementService.CanMove(fromRegionId, toRegionId)
	local fromRegion = RegionData.ById[fromRegionId]
	if not fromRegion then
		return false
	end

	for _, adjacentId in ipairs(fromRegion.adjacent) do
		if adjacentId == toRegionId then
			return true
		end
	end

	return false
end

function MovementService.ResolveArrival(state, playerState, regionId)
	local region = RegionData.ById[regionId]
	if not region then
		return false, "Unknown region"
	end

	playerState.position = regionId
	ResourceService.GrantRegionResources(playerState, region)

	if not playerState.discovered[regionId] then
		playerState.discovered[regionId] = true
		state.board[regionId].discoveredBy[playerState.userId] = true
		state:AddLog(playerState.name .. " discovered " .. region.name .. ".")
	else
		state:AddLog(playerState.name .. " arrived at " .. region.name .. ".")
	end

	local boardRegion = state.board[regionId]
	if boardRegion and boardRegion.buildings.Vineyard then
		local owner = state.players[boardRegion.buildings.Vineyard.ownerUserId]
		if owner then
			for _, resourceName in ipairs(region.resources) do
				ResourceService.Add(owner.resources, resourceName, 1)
				break
			end
			state:AddLog(owner.name .. "'s 畑 produced a resource at " .. region.name .. ".")
		end
	end

	return true
end

return MovementService

