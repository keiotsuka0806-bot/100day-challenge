local MarketEvents = {}

MarketEvents.List = {
	{ id = "cool_climate_boom", name = "Cool Climate Boom", target = { climate = "Cool" }, valueBonus = 2, incomeBonus = 0, duration = 2 },
	{ id = "pinot_popularity", name = "Pinot Popularity", target = { grapeType = "Pinot Noir" }, valueBonus = 0, incomeBonus = 3, duration = 2 },
	{ id = "new_world_trend", name = "New World Trend", target = { countries = { "USA", "Chile", "Australia" } }, valueBonus = 2, incomeBonus = 0, duration = 2 },
	{ id = "old_world_prestige", name = "Old World Prestige", target = { countries = { "France", "Italy", "Spain" } }, valueBonus = 2, incomeBonus = 0, duration = 2 },
	{ id = "sparkling_festival", name = "Sparkling Festival", target = { grapeType = "Sparkling" }, valueBonus = 0, incomeBonus = 3, duration = 2 },
	{ id = "dry_region_focus", name = "Dry Region Focus", target = { climate = "Dry" }, valueBonus = 1, incomeBonus = 2, duration = 2 },
	{ id = "asia_craft_attention", name = "Asia Craft Attention", target = { region = "Asia" }, valueBonus = 2, incomeBonus = 1, duration = 2 },
}

MarketEvents.InfoCards = {
	{ id = "peek_next_market", name = "相場予測", effect = "PeekNextMarket", description = "次の市場イベント候補を1枚見る。" },
	{ id = "cool_build_discount", name = "冷涼産地の洞察", effect = "CoolBuildDiscount", description = "Cool産地で次の建設コスト-1。" },
	{ id = "grape_income_boost", name = "品種需要レポート", effect = "GrapeIncomeBoost", description = "次の収益処理でGrape資源+1。" },
	{ id = "price_protection", name = "価格保護", effect = "PriceProtection", description = "次の不利な市場変動を1回無効化。" },
}

return MarketEvents

