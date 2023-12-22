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

  __getWeekDates(daysToFetch) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (daysToFetch - 1));

    return [startDate, endDate];
  },

  async __GetWeeksEvents(calendars, startDate, endDate) {
    const get = bent("string");

    const responses = await Promise.all(calendars.map((url) => get(url)));
    const iCalData = responses.map((response) => ICal.parseICS(response));

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
        .map((eventData) => {
          const adjustedEndDate = new Date(eventData.end);
          adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);

          return {
            name: eventData.summary,
            dateStart: {
              date: eventData.start.toDateString(),
              time: `${eventData.start.getHours()}:${eventData.start.getMinutes()}`,
              epoch: eventData.start.getTime()
            },
            dateEnd: {
              date: adjustedEndDate.toDateString(),
              time: `${adjustedEndDate.getHours()}:${adjustedEndDate.getMinutes()}`,
              epoch: adjustedEndDate.getTime()
            },
            location: eventData.location
          };
        });

      allFilteredEvents.push(...filteredEvents);
    });

    return allFilteredEvents;
  },

  async FormatEvents(calendars, startDate, endDate) {
    const events = await this.__GetWeeksEvents(calendars, startDate, endDate);

    let days = this.__getDatesBetween(startDate, endDate).map((date) => {
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

  async socketNotificationReceived(notification, config) {
    if (notification === "GET_EVENTS") {
      let [startDate, endDate] = this.__getWeekDates(config.daysToFetch);

      let { returnObj, days } = await this.FormatEvents(
        config.calendars,
        startDate,
        endDate
      );

      this.sendSocketNotification("EVENTS", { returnObj, days });
    }
  }
});
