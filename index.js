const phin = require('phin');
/**
 * URLs to scrape data from.
 */
const urlPatterns = {
  seasonData:
    'http://www.espn.com/nfl/team/schedule/_/name/{team}/season/{season}',
  playData: 'http://www.espn.com/nfl/game/_/gameId/{gameId}',
};
/**
 * Scrapes NFL game data from ESPN.
 *
 * **Disclaimer** As with all scrapers, this scraper is subject to break
 *  with any change in the response model sent back from ESPN.
 *
 * @class NFLGameData
 */
class NFLGameData {
  /**
   * Creates an instance of NFLGameData.
   * @param {String} team The abbreviation of the team's city
   *  ('sea', 'ne', etc.)
   * @param {String} season The season (2018, 2019, etc.).
   * @memberof NFLGameData
   */
  constructor(team, season) {
    this.team = team;
    this.season = season;
  }

  /**
   * Set the team abbreviation
   *
   * @memberof NFLGameData
   */
  set team(abbr) {
    this._team = abbr;
  }

  /**
   * Get the team abbreviation
   *
   * @memberof NFLGameData
   */
  get team() {
    return this._team;
  }

  /**
   * Set the season (year)
   *
   * @memberof NFLGameData
   */
  set season(year) {
    this._season = year;
  }

  /**
   * Get the season (year)
   *
   * @memberof NFLGameData
   */
  get season() {
    return this._season;
  }

  /**
   * Fetch the season data for the designated team/season from ESPN
   *
   * @returns {Object[]} Array of season data objects from ESPN
   * @memberof NFLGameData
   */
  async getSeasonData() {
    let seasonData = [];
    try {
      const res = await phin(this.getSeasonDataUrl());
      const body = res.body.toString('utf8');
      const espn = JSON.parse(body.match(NFLGameData.seasonDataRegex()));
      seasonData =
        /* The model data from ESPN */ espn
        && espn.page
        && espn.page.content
        && espn.page.content.scheduleData
        && espn.page.content.scheduleData.teamSchedule
          ? espn.page.content.scheduleData.teamSchedule
          : [];
    } catch (error) {
      console.error(error);
    }
    return seasonData;
  }

  /**
   * Gets the events object from the ESPN model for the specified
   * week number (game) and season type (pre, reg, post).
   *
   * @param {Number} num The week number (game) of the season type.
   * @param {String} seasonType The season type is either "pre", "reg",
   *  or "post" (For Preseason, Regular Season, and Postseason).
   * @returns {Object} The events object for the game. Contains the gameId
   *  used to make the request for play-by-play data.
   * @memberof NFLGameData
   */
  async getGameDetails(num, seasonType) {
    if (typeof num === 'undefined' || typeof seasonType === 'undefined') {
      throw new Error('Missing week number or season type (pre, reg, post).');
    }
    const seasonTypes = await this.getSeasonData();
    const seasonObj = seasonTypes.find(
      season => season.seasonType.abbreviation === seasonType.toLowerCase(),
    );
    // Post refers to events recorded after the game has ended (I think)
    let obj = (
      (seasonObj && seasonObj.events && seasonObj.events.post)
      || []
    ).find(event => event.week.number === num);
    // Set a default empty object if undefined
    obj = obj || {};
    // The game ID lives on the time.link URL. It is the last numeric element
    // on the url.
    obj.gameId = ((obj && obj.time && obj.time.link) || '').split('/').pop();
    return obj;
  }

  /**
   * Fetch the game details and play-by-play data from ESPN for the
   * given week number (game) of a season type.
   *
   * @param {Number} num The week number (game) of the season type.
   * @param {String} seasonType The season type is either "pre", "reg",
   *  or "post" (For Preseason, Regular Season, and Postseason).
   * @returns {Object} Returns a model containing game summary data and
   *  the associated plays data for that game.
   * @memberof NFLGameData
   */
  async getGameData(num, seasonType) {
    const gameDetails = await this.getGameDetails(num, seasonType);
    if (gameDetails && !gameDetails.gameId) {
      throw new Error(`There was no game ID associated with 
        TEAM: ${this.team}
        SEASON: ${this.season}
        SEASON TYPE: ${seasonType}
        WEEK: ${num}`);
    }
    const res = await phin(NFLGameData.getPlayDataUrl(gameDetails.gameId));
    const body = res.body.toString('utf8');
    const plays = JSON.parse(body.match(NFLGameData.playDataRegex()));
    return {
      plays,
      gameDetails,
    };
  }

  /**
   * The regular expression that captures the app data from
   * urlPatterns.seasonData response.
   *
   * @static
   * @returns {RegEx}
   * @memberof NFLGameData
   */
  static seasonDataRegex() {
    return new RegExp(/\{"app"(.*)(?=;<\/script>)/, 'gm');
  }

  /**
   *The regular expression that captures the play data from
   * urlPatterns.playData response.
   *
   * @static
   * @returns {RegEx}
   * @memberof NFLGameData
   */
  static playDataRegex() {
    return new RegExp(/\[{"play"(.*)(?=;\s*function)/, 'gm');
  }

  /**
   * Formulates the correct endpoint using the game ID to scrape the
   * play-by-play data.`
   *
   * @static
   * @param {String} gameId The numeric ID associated with the game.
   */
  static getPlayDataUrl(gameId) {
    return urlPatterns.playData.replace('{gameId}', gameId);
  }

  /**
   * Formulates the correct endpoint using the team and season to scrape
   * the season data.
   *
   * @returns {String} The URL to get season data from.
   * @memberof NFLGameData
   */
  getSeasonDataUrl() {
    return urlPatterns.seasonData
      .replace('{team}', this.team)
      .replace('{season}', this.season);
  }
}
module.exports = NFLGameData;
