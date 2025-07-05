// Client side

Module.register("MMM-CalendarDisplay", {
  defaults: {
    // array of objects with calendar information
    calendars: [],
    // amount of days to display events for (will not change how many are fetched)
    daysToDisplay: 7,
    // 5 mins as the default
    refreshTime: 600000
  },

  start() {},

  socketNotificationReceived(notification, payload) {},

  getTemplate() {
    return "CalendarDisplay.njk";
  },

  getStyles() {
    return ["CalendarDisplay.css"];
  },

  getTemplateData() {}
});
