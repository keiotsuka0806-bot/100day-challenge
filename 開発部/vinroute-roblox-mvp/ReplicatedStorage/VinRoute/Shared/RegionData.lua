local RegionData = {}

RegionData.List = {
	{ id = "burgundy", name = "Burgundy", country = "France", region = "Old World", grapeType = "Pinot Noir", climate = "Cool", rarity = "Rare", baseValue = 8, resources = { "Grape", "Knowledge" }, specialEffect = "PinotMarketBonus", adjacent = { "champagne", "bordeaux", "piedmont" } },
	{ id = "bordeaux", name = "Bordeaux", country = "France", region = "Old World", grapeType = "Cabernet Blend", climate = "Temperate", rarity = "Rare", baseValue = 8, resources = { "Grape", "Gold" }, specialEffect = "OldWorldValueBonus", adjacent = { "burgundy", "rioja", "douro" } },
	{ id = "champagne", name = "Champagne", country = "France", region = "Old World", grapeType = "Sparkling", climate = "Cool", rarity = "Epic", baseValue = 9, resources = { "Crystal", "Knowledge" }, specialEffect = "SparklingIncomeBonus", adjacent = { "burgundy", "mosel", "piedmont" } },
	{ id = "tuscany", name = "Tuscany", country = "Italy", region = "Old World", grapeType = "Sangiovese", climate = "Warm", rarity = "Rare", baseValue = 7, resources = { "Grape", "Gold" }, specialEffect = "CellarValueBonus", adjacent = { "piedmont", "rioja", "santorini" } },
	{ id = "piedmont", name = "Piedmont", country = "Italy", region = "Old World", grapeType = "Nebbiolo", climate = "Cool", rarity = "Rare", baseValue = 7, resources = { "Grape", "Knowledge" }, specialEffect = "RareCardValueBonus", adjacent = { "burgundy", "champagne", "tuscany" } },
	{ id = "rioja", name = "Rioja", country = "Spain", region = "Old World", grapeType = "Tempranillo", climate = "Warm", rarity = "Common", baseValue = 6, resources = { "Grape", "Gold" }, specialEffect = "BuiltIncomeBonus", adjacent = { "bordeaux", "tuscany", "douro" } },
	{ id = "mosel", name = "Mosel", country = "Germany", region = "Old World", grapeType = "Riesling", climate = "Cool", rarity = "Rare", baseValue = 7, resources = { "Knowledge", "Crystal" }, specialEffect = "ExtraMarketCardOnKnowledgeSuccess", adjacent = { "champagne", "tokaj", "marlborough" } },
	{ id = "douro", name = "Douro", country = "Portugal", region = "Old World", grapeType = "Blend", climate = "Warm", rarity = "Common", baseValue = 6, resources = { "Grape", "Crystal" }, specialEffect = "TradeResourceBonus", adjacent = { "bordeaux", "rioja", "bekaa" } },
	{ id = "napa", name = "Napa", country = "USA", region = "New World", grapeType = "Cabernet Sauvignon", climate = "Warm", rarity = "Epic", baseValue = 9, resources = { "Grape", "Gold" }, specialEffect = "WorkshopDiscount", adjacent = { "willamette", "maipo", "mendoza" } },
	{ id = "willamette", name = "Willamette", country = "USA", region = "New World", grapeType = "Pinot Noir", climate = "Cool", rarity = "Rare", baseValue = 7, resources = { "Grape", "Knowledge" }, specialEffect = "PinotValueBonus", adjacent = { "napa", "marlborough", "barossa" } },
	{ id = "mendoza", name = "Mendoza", country = "Argentina", region = "New World", grapeType = "Malbec", climate = "Dry", rarity = "Common", baseValue = 6, resources = { "Grape", "Gold" }, specialEffect = "DryIncomeBonus", adjacent = { "napa", "maipo", "capetown" } },
	{ id = "maipo", name = "Maipo", country = "Chile", region = "New World", grapeType = "Cabernet Sauvignon", climate = "Warm", rarity = "Common", baseValue = 6, resources = { "Grape", "Gold" }, specialEffect = "NewWorldValueBonus", adjacent = { "napa", "mendoza", "barossa" } },
	{ id = "barossa", name = "Barossa", country = "Australia", region = "New World", grapeType = "Shiraz", climate = "Hot", rarity = "Rare", baseValue = 7, resources = { "Grape", "Gold" }, specialEffect = "HotIncomeBonus", adjacent = { "maipo", "willamette", "marlborough", "yamanashi" } },
	{ id = "marlborough", name = "Marlborough", country = "New Zealand", region = "New World", grapeType = "Sauvignon", climate = "Cool", rarity = "Rare", baseValue = 7, resources = { "Knowledge", "Crystal" }, specialEffect = "CoolMarketInfoBonus", adjacent = { "willamette", "barossa", "yamanashi", "mosel" } },
	{ id = "yamanashi", name = "Yamanashi", country = "Japan", region = "Asia", grapeType = "Koshu-inspired", climate = "Cool", rarity = "Rare", baseValue = 7, resources = { "Knowledge", "Grape" }, specialEffect = "KnowledgeRewardBonus", adjacent = { "marlborough", "barossa", "ningxia" } },
	{ id = "capetown", name = "Cape Town", country = "South Africa", region = "New World", grapeType = "Blend", climate = "Warm", rarity = "Common", baseValue = 6, resources = { "Grape", "Gold" }, specialEffect = "TradeAnyResourceBonus", adjacent = { "mendoza", "santorini", "bekaa" } },
	{ id = "santorini", name = "Santorini", country = "Greece", region = "Mediterranean", grapeType = "Mineral", climate = "Dry", rarity = "Epic", baseValue = 8, resources = { "Crystal", "Knowledge" }, specialEffect = "CrystalValueBonus", adjacent = { "tuscany", "capetown", "bekaa", "tokaj" } },
	{ id = "tokaj", name = "Tokaj", country = "Hungary", region = "Old World", grapeType = "Sweet Craft", climate = "Cool", rarity = "Rare", baseValue = 7, resources = { "Knowledge", "Crystal" }, specialEffect = "CellarDiscount", adjacent = { "mosel", "santorini", "bekaa" } },
	{ id = "ningxia", name = "Ningxia", country = "China", region = "Asia", grapeType = "Cabernet Sauvignon", climate = "Dry", rarity = "Rare", baseValue = 7, resources = { "Grape", "Gold" }, specialEffect = "AsiaValueBonus", adjacent = { "yamanashi", "bekaa" } },
	{ id = "bekaa", name = "Bekaa", country = "Lebanon", region = "Mediterranean", grapeType = "Blend", climate = "Warm", rarity = "Common", baseValue = 6, resources = { "Grape", "Knowledge" }, specialEffect = "AdjacentDiscoveryBonus", adjacent = { "douro", "capetown", "santorini", "tokaj", "ningxia" } },
}

RegionData.ById = {}
for index, region in ipairs(RegionData.List) do
	region.index = index
	region.discoveredBy = {}
	RegionData.ById[region.id] = region
end

return RegionData

