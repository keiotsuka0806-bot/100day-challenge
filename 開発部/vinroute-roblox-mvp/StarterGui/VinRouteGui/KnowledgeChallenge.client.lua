local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local Remotes = ReplicatedStorage:WaitForChild("VinRoute"):WaitForChild("Remotes")
local KnowledgeChallengeRequest = Remotes:WaitForChild("KnowledgeChallengeRequest")
local OpenKnowledgeChallenge = Remotes:WaitForChild("OpenKnowledgeChallenge")
local ChallengeResult = Remotes:WaitForChild("ChallengeResult")

local gui = Instance.new("ScreenGui")
gui.Name = "VinRouteKnowledgeChallenge"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.fromOffset(460, 300)
panel.Position = UDim2.new(0.5, -230, 0.5, -150)
panel.BackgroundColor3 = Color3.fromRGB(28, 22, 16)
panel.Visible = false
panel.Parent = gui

local question = Instance.new("TextLabel")
question.Size = UDim2.new(1, -32, 0, 86)
question.Position = UDim2.fromOffset(16, 16)
question.BackgroundTransparency = 1
question.TextColor3 = Color3.fromRGB(255, 245, 225)
question.TextWrapped = true
question.TextXAlignment = Enum.TextXAlignment.Left
question.TextYAlignment = Enum.TextYAlignment.Top
question.Font = Enum.Font.GothamBold
question.TextSize = 16
question.Parent = panel

local result = Instance.new("TextLabel")
result.Size = UDim2.new(1, -32, 0, 58)
result.Position = UDim2.fromOffset(16, 226)
result.BackgroundTransparency = 1
result.TextColor3 = Color3.fromRGB(220, 205, 170)
result.TextWrapped = true
result.TextXAlignment = Enum.TextXAlignment.Left
result.Font = Enum.Font.Gotham
result.TextSize = 13
result.Parent = panel

local currentChallengeId = nil
local buttons = {}

local function makeChoice(index)
	local button = Instance.new("TextButton")
	button.Size = UDim2.new(1, -32, 0, 34)
	button.Position = UDim2.fromOffset(16, 104 + ((index - 1) * 38))
	button.BackgroundColor3 = Color3.fromRGB(86, 58, 35)
	button.TextColor3 = Color3.fromRGB(255, 245, 225)
	button.Font = Enum.Font.Gotham
	button.TextSize = 14
	button.Parent = panel
	button.MouseButton1Click:Connect(function()
		if currentChallengeId then
			KnowledgeChallengeRequest:FireServer({
				action = "Answer",
				answer = index,
			})
			for _, choice in ipairs(buttons) do
				choice.Active = false
			end
		end
	end)
	return button
end

for i = 1, 3 do
	table.insert(buttons, makeChoice(i))
end

OpenKnowledgeChallenge.OnClientEvent:Connect(function(challenge)
	currentChallengeId = challenge.id
	panel.Visible = true
	question.Text = challenge.question
	result.Text = "Choose one. Reward changes your market position, not direct score."

	for index, choiceText in ipairs(challenge.choices) do
		buttons[index].Text = choiceText
		buttons[index].Active = true
	end
end)

ChallengeResult.OnClientEvent:Connect(function(payload)
	currentChallengeId = nil
	result.Text = (payload.correct and "Success: " or "Learning: ") .. payload.explanation
	task.delay(3, function()
		panel.Visible = false
	end)
end)

