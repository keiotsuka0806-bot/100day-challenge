-- 電車コマの表示と移動演出。
-- サーバーは1回の移動でサイコロの目を1つ消費するので、
-- 状態更新ごとにコマをTweenで滑らせると「1マスずつ進む」手応えになる。

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer
local VinRoute = ReplicatedStorage:WaitForChild("VinRoute")
local Remotes = VinRoute:WaitForChild("Remotes")
local ClientStateUpdate = Remotes:WaitForChild("ClientStateUpdate")

local board = Workspace:WaitForChild("VinRouteBoard")
local nodes = board:WaitForChild("BoardNodes")

local PLAYER_COLORS = {
	Color3.fromRGB(220, 60, 60),
	Color3.fromRGB(60, 110, 220),
	Color3.fromRGB(230, 180, 40),
	Color3.fromRGB(70, 180, 90),
}

local TOKEN_HEIGHT = 2.2
local STEP_TIME = 0.35

-- 盤面を見下ろす固定カメラ(桃鉄のマップ視点)
local camera = Workspace.CurrentCamera
camera.CameraType = Enum.CameraType.Scriptable
camera.CFrame = CFrame.lookAt(Vector3.new(0, 120, 95), Vector3.new(0, 2, 0))

local tokensFolder = Instance.new("Folder")
tokensFolder.Name = "VinRouteTokens"
tokensFolder.Parent = board

local screen = Instance.new("ScreenGui")
screen.Name = "VinRouteMoveHud"
screen.ResetOnSpawn = false
screen.Parent = player:WaitForChild("PlayerGui")

local banner = Instance.new("TextLabel")
banner.Size = UDim2.fromOffset(300, 60)
banner.Position = UDim2.new(0.5, -150, 0, 16)
banner.BackgroundColor3 = Color3.fromRGB(20, 16, 12)
banner.BackgroundTransparency = 0.12
banner.TextColor3 = Color3.fromRGB(255, 245, 220)
banner.Font = Enum.Font.GothamBlack
banner.TextSize = 30
banner.Visible = false
banner.Parent = screen

local bannerCorner = Instance.new("UICorner")
bannerCorner.CornerRadius = UDim.new(0, 12)
bannerCorner.Parent = banner

local hint = Instance.new("TextLabel")
hint.Size = UDim2.fromOffset(300, 22)
hint.Position = UDim2.new(0.5, -150, 0, 78)
hint.BackgroundTransparency = 1
hint.TextColor3 = Color3.fromRGB(255, 240, 150)
hint.Font = Enum.Font.GothamBold
hint.TextSize = 14
hint.Text = "光った駅をクリックして進む"
hint.Visible = false
hint.Parent = screen

local function nodePosition(regionId)
	local part = nodes:FindFirstChild(regionId)
	if part then
		return part.Position
	end
	return nil
end

-- 同じ駅に複数コマが乗っても重ならないよう少しずらす
local function playerOffset(index)
	local angle = (index - 1) * (math.pi / 2)
	return Vector3.new(math.cos(angle) * 1.6, 0, math.sin(angle) * 1.6)
end

local tokens = {}
local placed = {}

local function ensureToken(userId, index, name)
	local existing = tokens[userId]
	if existing then
		return existing
	end

	local color = PLAYER_COLORS[((index - 1) % #PLAYER_COLORS) + 1]

	local body = Instance.new("Part")
	body.Name = "Token_" .. tostring(userId)
	body.Anchored = true
	body.CanCollide = false
	body.Size = Vector3.new(2.4, 1.4, 3.2)
	body.Material = Enum.Material.SmoothPlastic
	body.Color = color
	body.Parent = tokensFolder

	local label = Instance.new("BillboardGui")
	label.Size = UDim2.fromOffset(130, 26)
	label.StudsOffset = Vector3.new(0, 2.4, 0)
	label.AlwaysOnTop = true
	label.Parent = body

	local text = Instance.new("TextLabel")
	text.Size = UDim2.fromScale(1, 1)
	text.BackgroundTransparency = 1
	text.Text = "🚂 " .. name
	text.TextColor3 = Color3.fromRGB(255, 255, 255)
	text.TextStrokeTransparency = 0.3
	text.Font = Enum.Font.GothamBold
	text.TextSize = 14
	text.Parent = label

	tokens[userId] = body
	return body
end

local function moveToken(token, targetPosition)
	local fromPosition = token.Position
	local direction = targetPosition - fromPosition
	local goalCFrame
	if direction.Magnitude > 0.01 then
		goalCFrame = CFrame.lookAt(targetPosition, targetPosition + Vector3.new(direction.X, 0, direction.Z))
	else
		goalCFrame = CFrame.new(targetPosition)
	end

	TweenService:Create(
		token,
		TweenInfo.new(STEP_TIME, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{ CFrame = goalCFrame }
	):Play()
end

local highlights = {}

local function clearHighlights()
	for _, highlight in ipairs(highlights) do
		highlight:Destroy()
	end
	highlights = {}
end

local function applyHighlights(optionIds)
	clearHighlights()
	for _, regionId in ipairs(optionIds or {}) do
		local part = nodes:FindFirstChild(regionId)
		if part then
			local highlight = Instance.new("Highlight")
			highlight.FillColor = Color3.fromRGB(90, 230, 120)
			highlight.FillTransparency = 0.5
			highlight.OutlineColor = Color3.fromRGB(255, 240, 120)
			highlight.OutlineTransparency = 0
			highlight.Adornee = part
			highlight.Parent = part
			table.insert(highlights, highlight)
		end
	end
end

ClientStateUpdate.OnClientEvent:Connect(function(state)
	if not state or not state.players then
		return
	end

	for index, p in ipairs(state.players) do
		local token = ensureToken(p.userId, index, p.name)
		local basePosition = nodePosition(p.position)
		if basePosition then
			local target = basePosition + Vector3.new(0, TOKEN_HEIGHT, 0) + playerOffset(index)
			if not placed[p.userId] then
				token.CFrame = CFrame.new(target)
				placed[p.userId] = true
			else
				moveToken(token, target)
			end
		end
	end

	local isMyMove = state.currentUserId == player.UserId and state.phase == "Move"
	if isMyMove then
		applyHighlights(state.moveOptions)
		local remaining = state.dice or 0
		banner.Text = "あと " .. tostring(remaining) .. " マス"
		banner.Visible = remaining > 0
		hint.Visible = remaining > 0
	else
		clearHighlights()
		banner.Visible = false
		hint.Visible = false
	end
end)
