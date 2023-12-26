const NodeHelper = require("node_helper");
const bent = require("bent");
const ICal = require("node-ical");
const { rrulestr, RRuleSet } = require("rrule");
const rruleCache = {};

module.exports = NodeHelper.create({
  __GetDatesBetween(startDate, endDate) {
    const datesArray = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      datesArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return datesArray;
  },

  __GetWeekDates(daysToFetch) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (daysToFetch - 1));

    return [startDate, endDate];
  },

  __MapEventData(eventData) {
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
  },

  async __GetWeeksEvents(calendars, startDate, endDate) {
    const get = bent("string");
    const allFilteredEvents = [];
    const firstOfMonth = new Date().setDate(1);

    const responses = await Promise.all(calendars.map((url) => get(url)));
    const iCalData = responses.map((response) => ICal.parseICS(response));

    for (const data of iCalData) {
      const events = Object.keys(data)
        .map((event) => data[event])
        .filter((eventData) => eventData.type === "VEVENT");

      const filteredEvents = events
        .filter(
          (eventData) =>
            eventData.end >= startDate && eventData.start <= endDate
        )
        .map(this.__MapEventData);

      const recurringEvents = events
        .filter(
          (eventData) => eventData.rrule && eventData.start >= firstOfMonth
        )
        .flatMap((eventData) => {
          const rrule = rrulestr(eventData.rrule.toString());

          const dates =
            rruleCache[rrule] ||
            rrule.between(startDate, endDate, false, (e) => {
              return e.getTime();
            });

          if (!rruleCache[rrule]) rruleCache[rrule] = dates;

          if (dates.length === 0) return null;
          return dates.map((date) => {
            return this.__MapEventData({ ...eventData, start: date });
          });
        })
        .filter(Boolean);

      allFilteredEvents.push(...filteredEvents, ...recurringEvents);
    }

    console.log("All events fetched");
    return allFilteredEvents;
  },

  async FormatEvents(calendars, startDate, endDate) {
    const events = await this.__GetWeeksEvents(calendars, startDate, endDate);

    let days = this.__GetDatesBetween(startDate, endDate).map((date) => {
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

      if (
        fullDays.includes(event.dateStart.date) ||
        fullDays.includes(event.dateEnd.date)
      ) {
        if (event.dateEnd.epoch > event.dateStart.epoch) {
          let between = this.__GetDatesBetween(
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
      if (config.daysToFetch === 0) return;
      if (config.daysToFetch > 30) config.daysToFetch = 30;

      let [startDate, endDate] = this.__GetWeekDates(config.daysToFetch);

      let { returnObj, days } = await this.FormatEvents(
        config.calendars,
        startDate,
        endDate
      );

      this.sendSocketNotification("EVENTS", { returnObj, days });
    }
  }
});
