
async function eventsBySupportJobs() {
  const url = `https://streamingtv.fun:3440/api/listEventsBySport/4`;
  try {
    const response = await axios.get(url);
    const events = response.data; 
    if(events.length > 0){
      var sportsEventData = events.map((element) => ({
        updateOne: {
          filter: { Id: element.Id },
          update: {
            $set: {
              sportsId: sportsId,
              sport: element.sport,
              competitionId: element.competitionId,
              competitionName: element.competitionName,
              Id: element.Id,
              name: element.name,
              countryCode: element.countryCode,
              timezone: element.timezone,
              openDate: element.openDate,
              inplay: element.inplay,
              hasFancy: element.hasFancy,
              status: element.status,
              isPremium: element.isPremium,
              type: element.type,
              matchType: getMatchType(element.competitionName, element.name, sportsId)
            },
          },
          upsert: true,
        },
      }));
    }

    // 1"obet.com/*"
    const savedEvents = await inPlayEvents.bulkWrite(sportsEventData);
    // console.log('===== Saved Events bulkWrite logs ', savedEvents?.result?.upserted)
    return({
      success: true,
      message: 'Events retrieved and saved successfully',
      events: events,
      newInsertedIds: savedEvents?.result?.upserted
    });
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to get or save events',
      error: error.message,
    });
  }
}

eventsBySupportJobs()