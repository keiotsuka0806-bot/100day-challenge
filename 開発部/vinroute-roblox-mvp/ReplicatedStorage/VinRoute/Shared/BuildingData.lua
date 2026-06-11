local BuildingData = {}

BuildingData.Types = {
	Vineyard = {
		id = "Vineyard",
		name = "畑",
		cost = {
			Grape = 2,
		},
		assetValue = 4,
		description = "産地資源の安定収集。通過または到着時に資源を得る。",
	},
	Workshop = {
		id = "Workshop",
		name = "工房",
		cost = {
			Grape = 1,
			Gold = 2,
		},
		assetValue = 7,
		description = "クラフトボトル制作の拠点。シーズン終了時に文化資産価値を生む。",
	},
	Cellar = {
		id = "Cellar",
		name = "セラー",
		cost = {
			Crystal = 2,
			Knowledge = 1,
		},
		assetValue = 10,
		description = "熟成品の価値を高める。市場イベント補正を強める。",
	},
}

BuildingData.Order = { "Vineyard", "Workshop", "Cellar" }

return BuildingData

