local ReplicatedStorage = game:GetService("ReplicatedStorage")

local VinRoute = ReplicatedStorage:WaitForChild("VinRoute")
local RegionData = require(VinRoute:WaitForChild("Shared"):WaitForChild("RegionData"))

local board = script.Parent
local nodes = board:FindFirstChild("BoardNodes") or Instance.new("Folder")
nodes.Name = "BoardNodes"
nodes.Parent = board

local routes = board:FindFirstChild("RouteLines") or Instance.new("Folder")
routes.Name = "RouteLines"
routes.Parent = board

local radius = 52
local center = Vector3.new(0, 2, 0)

local positions = {}

for index, region in ipairs(RegionData.List) do
	local angle = ((index - 1) / #RegionData.List) * math.pi * 2
	local position = center + Vector3.new(math.cos(angle) * radius, 0, math.sin(angle) * radius)
	positions[region.id] = position

	local part = Instance.new("Part")
	part.Name = region.id
	part.Anchored = true
	part.Size = Vector3.new(6, 1, 6)
	part.Position = position
	part.Material = Enum.Material.SmoothPlastic
	part.Color = Color3.fromRGB(74, 112, 73)
	part.Parent = nodes

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Move"
	prompt.ObjectText = region.name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 12
	prompt.Parent = part
	prompt.Triggered:Connect(function(player)
		local move = _G.VinRouteServerMove
		if move then
			move(player, region.id)
		end
	end)

	-- 盤面を見下ろしたままクリックで進めるようにする(桃鉄の方向選択にあたる)
	local click = Instance.new("ClickDetector")
	click.MaxActivationDistance = math.huge
	click.Parent = part
	click.MouseClick:Connect(function(player)
		local move = _G.VinRouteServerMove
		if move then
			move(player, region.id)
		end
	end)

	local label = Instance.new("BillboardGui")
	label.Size = UDim2.fromOffset(140, 40)
	label.StudsOffset = Vector3.new(0, 4, 0)
	label.AlwaysOnTop = true
	label.Parent = part

	local text = Instance.new("TextLabel")
	text.Size = UDim2.fromScale(1, 1)
	text.BackgroundTransparency = 1
	text.Text = region.name
	text.TextColor3 = Color3.fromRGB(255, 245, 225)
	text.TextStrokeTransparency = 0.4
	text.Font = Enum.Font.GothamBold
	text.TextSize = 13
	text.Parent = label
end

local drawn = {}
for _, region in ipairs(RegionData.List) do
	for _, adjacentId in ipairs(region.adjacent) do
		local keyA = region.id .. ":" .. adjacentId
		local keyB = adjacentId .. ":" .. region.id
		if not drawn[keyA] and not drawn[keyB] and positions[adjacentId] then
			drawn[keyA] = true
			local a = positions[region.id]
			local b = positions[adjacentId]
			local midpoint = (a + b) / 2
			local distance = (a - b).Magnitude

			local route = Instance.new("Part")
			route.Name = region.id .. "_to_" .. adjacentId
			route.Anchored = true
			route.Size = Vector3.new(1, 0.25, distance)
			route.Position = midpoint
			route.CFrame = CFrame.lookAt(midpoint, b)
			route.Material = Enum.Material.SmoothPlastic
			route.Color = Color3.fromRGB(150, 120, 70)
			route.Parent = routes
		end
	end
end
