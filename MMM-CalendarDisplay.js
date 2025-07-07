// Client side

/**
 * MMM-CalendarDisplay
 * A MagicMirror module that displays calendar events in a calendar format.
 *
 * Keywords:
 *  PRIVATE : This is a private function and should not be used outside of this module.
 *
 * Author:
 *  Tom Ticehurst
 */

Module.register("MMM-CalendarDisplay", {
  defaults: {
    // An array of calendar objects that will be used to style and grab ical information
    calendars: [],
    // The amount of days to fetch display on the calendar
    // This will not change how many are fetched because of the addon module
    // only how many days are rendered and displayed onto the calendar itself
    daysToDisplay: 7,
    // 10 minute default refresh timer in milliseconds, just because of how many events it may have to process and the unlikely chance of it changing that often
    refreshTime: 600000
  },

  // Private function - check valid URL
  PRIVATE_isValidUrl(url) {
    // Run a try-catch block to validate the URL
    try {
      // Attempt to create a new URL object with the provided URL
      new URL(url);
      // If the URL is valid, return true
      return true;
    } catch (e) {
      // If an error is thrown, the URL is invalid, so return false
      return false;
    }
  },

  // Start function - This is run when the module loads on the client side
  start() {
    console.log("CAL LOADED - CLIENT SIDE");

    if (!Array.isArray(this.config.calendars) || this.config.calendars.length <= 0) {
      console.error("MMM-CalendarDisplay: No calendars configured. Please add at least one calendar to the config.");
      return;
    }

    // Validate each calendar URL in the config
    // If the URL is invalid, log an error to the console
    this.config.calendars.forEach((cal) => {
      // Checks to make sure there is a URL, then validates it. If either fail then raise an error
      if (!cal.url || !this.PRIVATE_isValidUrl(cal.url)) {
        // Raise an error
        console.error(`MMM-CalendarDisplay: Invalid URL for calendar ${cal.name}: ${cal.url || "None"}`);
      }
    });

    // Use the integrated "sendSocketNotification" function to send a notification to the server using calendars from the config as a payload
    // Map the calendars object to an array of URLs
    this.sendSocketNotification(
      "GET_EVENTS",
      this.config.calendars.map((cal) => cal.url)
    );
  },

  // This function is called when the server sends a notification to the client
  // Contains the notification string and any data under the payload
  socketNotificationReceived(notification, payload) {
    // !TODO - Listen for a notification from the server with a list of events, update the template accordingly
  },

  // This returns the template file that will be used to render the module
  getTemplate() {
    return "CalendarDisplay.njk";
  },

  // This returns the styles that will be used to style the module
  getStyles() {
    return ["CalendarDisplay.css"];
  },

  // This passes through any data to the template from 'this'
  getTemplateData() {}
});
