Module.register("MMM-CalendarDisplay", {
  defaults: {
    calendars: [],
    daysToFetch: 7
  },

  __getWeekendDates() {
    const today = new Date();
    let currentDay = today.getDay();
    const daysToAdd = currentDay === 6 ? 0 : 6 - currentDay;

    const nextSaturday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + daysToAdd
    );
    const nextSunday = new Date(
      nextSaturday.getFullYear(),
      nextSaturday.getMonth(),
      nextSaturday.getDate() + 1
    );

    return [nextSaturday.toDateString(), nextSunday.toDateString()];
  },

  start() {
    this.sendSocketNotification(
      // TODO: Add support for colours, currently mapping to URL only
      "GET_EVENTS",
      {
        calendars: this.config.calendars.map((cal) => cal.url),
        daysToFetch: this.config.daysToFetch
      }
    );

    this.nunjucksEnvironment().addFilter("getEventsForDay", (day) => {
      return this.events[day];
    });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "EVENTS") {
      let [saturday, sunday] = this.__getWeekendDates();
      this.events = payload.returnObj;
      this.days = payload.days;

      this.today = new Date().toDateString();
      this.saturday = saturday;
      this.sunday = sunday;

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
      days: this.days,
      today: this.today,
      saturday: this.saturday,
      sunday: this.sunday
    };
  }
});
