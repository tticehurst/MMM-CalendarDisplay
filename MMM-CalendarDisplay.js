Module.register("MMM-CalendarDisplay", {
  defaults: {
    calendars: []
  },

  start() {
    this.sendSocketNotification(
      // TODO: Add support for colours, currently mapping to URL only
      "GET_EVENTS",
      this.config.calendars.map((cal) => cal.url)
    );

    this.nunjucksEnvironment().addFilter("getEventsForDay", (day) => {
      console.log(day);
      return this.events[day];
    });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "EVENTS") {
      this.events = payload.returnObj;
      this.days = payload.days;
      this.updateDom();
    }
  },

  getTemplate() {
    return "CalendarDisplay.njk";
  },

  getStyles() {
    return ["CalendarDisplay.css"];
  },

  getTemplateData() {
    return {
      events: this.events,
      days: this.days
    };
  }
});
