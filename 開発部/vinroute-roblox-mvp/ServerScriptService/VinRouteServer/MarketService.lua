local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Shared")
local MarketEvents = require(Shared:WaitForChild("MarketEvents"))

local MarketService = {}

local function includes(list, value)
	if not list then
		return false
	end

	for _, item in ipairs(list) do
		if item == value then
			return true
		end
	end

	return false
end

function MarketService.GetEventById(eventId)
	for _, event in ipairs(MarketEvents.List) do
		if event.id == eventId then
			return event
		end
	end
	return nil
end

function MarketService.RegionMatchesEvent(region, event)
	local target = event.target
	if target.climate and region.climate ~= target.climate then
		return false
	end
	if target.grapeType and region.grapeType ~= target.grapeType then
		return false
	end
	if target.region and region.region ~= target.region then
		return false
	end
	if target.countries and not includes(target.countries, region.country) then
		return false
	end
	return true
end

function MarketService.PickEvent(excludeId)
	local candidates = {}
	for _, event in ipairs(MarketEvents.List) do
		if event.id ~= excludeId then
			table.insert(candidates, event)
		end
	end

	return candidates[math.random(1, #candidates)]
end

function MarketService.AdvanceEvents(state)
	local remaining = {}
	for _, active in ipairs(state.activeMarketEvents) do
		active.remaining -= 1
		if active.remaining > 0 then
			table.insert(remaining, active)
		end
	end
	state.activeMarketEvents = remaining
end

function MarketService.TriggerNewEvent(state)
	local event = nil
	if state.nextMarketEventId then
		event = MarketService.GetEventById(state.nextMarketEventId)
	end

	if not event then
		event = MarketService.PickEvent(nil)
	end

	table.insert(state.activeMarketEvents, {
		id = event.id,
		name = event.name,
		valueBonus = event.valueBonus,
		incomeBonus = event.incomeBonus,
		remaining = event.duration,
	})

	local nextEvent = MarketService.PickEvent(event.id)
	state.nextMarketEventId = nextEvent.id
	state:AddLog("Market event: " .. event.name .. ".")
end

function MarketService.DrawInfoCard()
	return MarketEvents.InfoCards[math.random(1, #MarketEvents.InfoCards)]
end

function MarketService.ApplyInfoCard(playerState, card)
	table.insert(playerState.marketInfoCards, card)

	if card.effect == "CoolBuildDiscount" then
		playerState.buildDiscount = (playerState.buildDiscount or 0) + 1
	elseif card.effect == "PriceProtection" then
		playerState.priceProtection = (playerState.priceProtection or 0) + 1
	end
end

return MarketService

