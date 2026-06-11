local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Shared")
local Challenges = require(Shared:WaitForChild("KnowledgeChallenges"))
local RegionData = require(Shared:WaitForChild("RegionData"))

local ResourceService = require(script.Parent:WaitForChild("ResourceService"))
local MarketService = require(script.Parent:WaitForChild("MarketService"))

local KnowledgeService = {}

function KnowledgeService.PickChallenge()
	return Challenges.List[math.random(1, #Challenges.List)]
end

function KnowledgeService.GetChallengeById(challengeId)
	for _, challenge in ipairs(Challenges.List) do
		if challenge.id == challengeId then
			return challenge
		end
	end
	return nil
end

function KnowledgeService.ApplyReward(state, playerState, reward)
	if reward.type == "MarketInfoCard" then
		for _ = 1, reward.amount do
			local card = MarketService.DrawInfoCard()
			MarketService.ApplyInfoCard(playerState, card)
		end
	elseif reward.type == "ResourceBonus" then
		ResourceService.Add(playerState.resources, reward.resource, reward.amount)
	elseif reward.type == "BuildDiscount" then
		playerState.buildDiscount = (playerState.buildDiscount or 0) + reward.amount
	elseif reward.type == "RegionInsight" then
		for _, region in ipairs(RegionData.List) do
			if not playerState.discovered[region.id] then
				playerState.discovered[region.id] = true
				state.board[region.id].discoveredBy[playerState.userId] = true
				break
			end
		end
	end
end

function KnowledgeService.ResolveAnswer(state, playerState, challengeId, answerIndex)
	local challenge = KnowledgeService.GetChallengeById(challengeId)
	if not challenge then
		return false, "Unknown challenge"
	end

	local correct = challenge.answer == answerIndex
	if correct then
		KnowledgeService.ApplyReward(state, playerState, challenge.reward)
		state:AddLog(playerState.name .. " succeeded in a knowledge challenge.")

		local currentRegion = RegionData.ById[playerState.position]
		if currentRegion and currentRegion.specialEffect == "ExtraMarketCardOnKnowledgeSuccess" then
			local card = MarketService.DrawInfoCard()
			MarketService.ApplyInfoCard(playerState, card)
		end

		if currentRegion and currentRegion.specialEffect == "KnowledgeRewardBonus" then
			ResourceService.Add(playerState.resources, "Knowledge", 1)
		end
	else
		state:AddLog(playerState.name .. " learned from a knowledge challenge.")
	end

	return true, {
		correct = correct,
		explanation = challenge.explanation,
		reward = challenge.reward,
	}
end

return KnowledgeService

