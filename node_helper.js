const NodeHelper = require("node_helper");
const bent = require("bent");
const ICal = require("node-ical");

module.exports = NodeHelper.create({
  __getDatesBetween(startDate, endDate) {
    const datesArray = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      datesArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return datesArray;
  },

  __getWeekDates() {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    return [startDate, endDate];
  },

  async __GetWeeksEvents(calendars) {
    const get = bent("string");

    const responses = await Promise.all(calendars.map((url) => get(url)));
    const iCalData = responses.map((response) => ICal.parseICS(response));

    const currentDate = new Date();
    const startDate = new Date(currentDate);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const allFilteredEvents = [];

    iCalData.forEach((data) => {
      const events = Object.keys(data);
      const filteredEvents = events
        .map((event) => data[event])
        .filter(
          (eventData) =>
            eventData.type === "VEVENT" &&
            eventData.end >= startDate &&
            eventData.start <= endDate
        )
        .map((eventData) => ({
          name: eventData.summary,
          dateStart: {
            date: eventData.start.toDateString(),
            time: `${eventData.start.getHours()}:${eventData.start.getMinutes()}`,
            epoch: eventData.start.getTime()
          },
          dateEnd: {
            date: eventData.end.toDateString(),
            time: `${eventData.end.getHours()}:${eventData.end.getMinutes()}`,
            epoch: eventData.end.getTime()
          },
          location: eventData.location
        }));

      allFilteredEvents.push(...filteredEvents);
    });

    return allFilteredEvents;
  },

  async FormatEvents(calendars) {
    const events = await this.__GetWeeksEvents(calendars);

    let [weekStart, weekEnd] = this.__getWeekDates();
    let days = this.__getDatesBetween(weekStart, weekEnd).map((date) => {
      let [weekday, day] = date
        .toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
        .split(" ");

      return {
        weekday,
        day,
        full: new Date(date.setHours(0, 0, 0, 0)).toDateString()
      };
    });

    let returnObj = {};

    days.forEach((day) => {
      returnObj[day.full] = [];
    });

    events.forEach((event) => {
      let fullDays = days.map((day) => day.full);

      if (fullDays.includes(event.dateStart.date)) {
        if (event.dateEnd.epoch > event.dateStart.epoch) {
          let between = this.__getDatesBetween(
            new Date(event.dateStart.date),
            new Date(event.dateEnd.date)
          ).map((date) => date.toDateString());

          between.forEach((date) => {
            if (returnObj[date]) {
              returnObj[date].push(event);
            }
          });
        } else {
          if (returnObj[event.dateStart.date]) {
            returnObj[event.dateStart.date].push(event);
          }
        }
      }
    });

    return { returnObj, days };
  },

  async socketNotificationReceived(notification, urls) {
    if (notification === "GET_EVENTS") {
      let { returnObj, days } = await this.FormatEvents(urls);

      this.sendSocketNotification("EVENTS", { returnObj, days });
    }
  }
});
