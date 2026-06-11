local ResourceService = {}

function ResourceService.CanPay(resources, cost)
	for key, amount in pairs(cost) do
		if (resources[key] or 0) < amount then
			return false
		end
	end
	return true
end

function ResourceService.Pay(resources, cost)
	if not ResourceService.CanPay(resources, cost) then
		return false
	end

	for key, amount in pairs(cost) do
		resources[key] = (resources[key] or 0) - amount
	end

	return true
end

function ResourceService.Add(resources, resourceName, amount)
	resources[resourceName] = (resources[resourceName] or 0) + amount
end

function ResourceService.GrantRegionResources(playerState, region)
	for _, resourceName in ipairs(region.resources) do
		ResourceService.Add(playerState.resources, resourceName, 1)
	end
end

return ResourceService

