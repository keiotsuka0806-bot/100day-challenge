local KnowledgeChallenges = {}

KnowledgeChallenges.List = {
	{
		id = "cool_climate_profile",
		question = "Cool climate regions often create which profile?",
		choices = { "Bright acidity", "Very heavy tropical sweetness", "Smoky bitterness" },
		answer = 1,
		explanation = "Cool climate regions often preserve freshness and bright acidity.",
		reward = { type = "MarketInfoCard", amount = 1 },
	},
	{
		id = "pinot_region",
		question = "Which region is strongly linked to Pinot Noir culture?",
		choices = { "Burgundy", "Ningxia", "Douro" },
		answer = 1,
		explanation = "Burgundy is a classic cultural home for Pinot Noir.",
		reward = { type = "BuildDiscount", amount = 1 },
	},
	{
		id = "riesling_climate",
		question = "Riesling is often associated with which climate style?",
		choices = { "Cool", "Hot desert", "Tropical" },
		answer = 1,
		explanation = "Riesling is strongly associated with cool regions such as Mosel.",
		reward = { type = "ResourceBonus", resource = "Knowledge", amount = 2 },
	},
	{
		id = "new_world_reading",
		question = "USA, Chile, and Australia are grouped as what market category here?",
		choices = { "New World", "Old World", "Mediterranean" },
		answer = 1,
		explanation = "In this MVP, these countries are grouped as New World regions.",
		reward = { type = "MarketInfoCard", amount = 1 },
	},
	{
		id = "cellar_strategy",
		question = "Which facility increases mature cultural asset value?",
		choices = { "セラー", "畑", "道標" },
		answer = 1,
		explanation = "セラーは熟成品と文化資産の価値を高める施設です。",
		reward = { type = "BuildDiscount", amount = 1 },
	},
	{
		id = "sparkling_market",
		question = "Which region is tied to the Sparkling Festival event?",
		choices = { "Champagne", "Mendoza", "Tokaj" },
		answer = 1,
		explanation = "Champagne is the Sparkling-style MVP region.",
		reward = { type = "ResourceBonus", resource = "Crystal", amount = 1 },
	},
}

return KnowledgeChallenges

