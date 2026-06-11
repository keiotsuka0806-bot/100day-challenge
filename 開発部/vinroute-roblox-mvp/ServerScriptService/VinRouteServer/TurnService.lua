local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Shared")
local GameConstants = require(Shared:WaitForChild("GameConstants"))

local MarketService = require(script.Parent:WaitForChild("MarketService"))
local AssetValueService = require(script.Parent:WaitForChild("AssetValueService"))

local TurnService = {}

function TurnService.RollDice(state, player)
	if state.status ~= "Running" or state.phase ~= "Roll" then
		return false, "Not in roll phase"
	end

	if not state:IsCurrentPlayer(player) then
		return false, "Not your turn"
	end

	state.dice = math.random(1, GameConstants.DiceSides)
	state.phase = "Move"
	state:AddLog(state:GetCurrentPlayer().name .. " rolled " .. tostring(state.dice) .. ".")
	return true, state.dice
end

function TurnService.CompleteAction(state)
	state.phase = "Build"
end

function TurnService.EndTurn(state)
	if state.status ~= "Running" then
		return nil
	end

	state:AdvanceTurn()

	if state:IsFinished() then
		state.status = "Finished"
		state.phase = "Finished"
		local ranking = AssetValueService.CalculateAll(state)
		state:AddLog("Final ranking calculated.")
		return ranking
	end

	if state.currentPlayerIndex == 1 and state.roundInSeason == 1 then
		MarketService.AdvanceEvents(state)
		MarketService.TriggerNewEvent(state)
		AssetValueService.CalculateAll(state)
	end

	return nil
end

return TurnService

