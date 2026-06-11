local GameConstants = {}

GameConstants.MinPlayers = 2
GameConstants.MaxPlayers = 4
GameConstants.DefaultMode = "Standard"

GameConstants.Modes = {
	Short = {
		label = "Short",
		seasons = 3,
		turnsPerPlayerPerSeason = 2,
		estimatedMinutes = "20-25",
	},
	Standard = {
		label = "Standard",
		seasons = 5,
		turnsPerPlayerPerSeason = 2,
		estimatedMinutes = "35-45",
	},
	Long = {
		label = "Long",
		seasons = 7,
		turnsPerPlayerPerSeason = 2,
		estimatedMinutes = "50-60",
	},
}

GameConstants.StartingResources = {
	Grape = 2,
	Knowledge = 1,
	Gold = 2,
	Crystal = 0,
}

GameConstants.ResourceValues = {
	Grape = 1,
	Knowledge = 2,
	Gold = 2,
	Crystal = 3,
}

GameConstants.DiceSides = 6

return GameConstants

