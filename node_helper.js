const NodeHelper = require("node_helper");
const bent = require("bent");
const ICal = require("node-ical");

module.exports = NodeHelper.create({
  async GetEvents(calendars) {
    const get = bent("string");

    const responses = await Promise.all(calendars.map((url) => get(url)));
    const iCalData = responses.map((response) => ICal.parseICS(response));

    const currentDate = new Date();
    const daysUntilMonday = (currentDate.getDay() + 6) % 7;
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - daysUntilMonday);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const events = Object.keys(iCalData[0]);
    const filteredEvents = events
      .map((event) => iCalData[0][event])
      .filter(
        (eventData) =>
          eventData.type === "VEVENT" &&
          eventData.start >= startDate &&
          eventData.end <= endDate
      )
      .map((eventData) => ({
        name: eventData.summary,
        dateStart: eventData.start,
        dateEnd: eventData.end,
        location: eventData.location
      }));

    return filteredEvents;
  },

  async socketNotificationReceived(notification, urls) {
    if (notification === "GET_EVENTS") {
      let data = await this.GetEvents(urls);

      console.log(data);
    }
  }
});
