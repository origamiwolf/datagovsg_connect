function isAdminUser() {
  return false;
}

function getAuthType() {
  var response = { type: 'NONE' };
  return response;
}

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  // todo: validation
  
  config.newInfo()
  .setId('Instructions')
  .setText('Enter dataset name to connect to.');

  config.newTextInput()
  .setId('dataset')
  .setName('Enter the name of a dataset')
  .setHelpText('Refer to https://data.gov.sg/dataset/ckan-package-list for full list of datasets.')
  .setPlaceholder('age-distribution-of-cars');

  return config.build();
}

function getFields(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var myfields = cc.getFields();
  var types = cc.FieldType;

  var url = [
    'https://data.gov.sg/api/action/package_show?id=',
    request.configParams.dataset
  ];
  var response = UrlFetchApp.fetch(url.join(''));
  var parsedResponse = JSON.parse(response).result.resources[0].fields;
  var datasetID = JSON.parse(response).result.resources[0].id;
  var myfieldtype;
  // TODO: add more datetime formats
  parsedResponse.forEach(function(x) {
    switch(x["type"]) {
      case "numeric":
        myfields.newMetric()
        .setId(x["name"])
        .setType(types.NUMBER)
        break;
      case "datetime":
        switch(x["format"]) {
          case "YYYY-MM-DD":
            datetimetype = types.YEAR_MONTH_DAY;
            break;           
          case "YYYY-MM":
            datetimetype = types.YEAR_MONTH;
            break;
          case "YYYY":
            datetimetype = types.YEAR;
            break;            
          default:
            datetimetype = types.TEXT;
            break;
        }
        myfields.newDimension()
          .setId(x["name"])
          .setType(datetimetype)
        break;
      default:
        myfields.newDimension()
        .setId(x["name"])
        .setType(types.TEXT)
        break;
    }
  });
  request.configParams.dataset = datasetID;
  return myfields;
}

function getSchema(request) {
  var fields = getFields(request).build();
  return { schema: fields, config: "dataset" }
}

function responseToRows(requestedFields, response) {
  return response.map(function(getRowData) {
    var row = [];
    requestedFields.asArray().forEach(function(field) {
      var cc = DataStudioApp.createCommunityConnector();
      var types = cc.FieldType;      
      // Need to ensure data formats for datetime fits!
      field_value = getRowData[field.getId()];
      switch (field.getType()) {
        case types.YEAR_MONTH_DAY:
        case types.YEAR_MONTH:
          field_value = field_value.replace(/-/g,'');
          break;
      }    
      row.push(field_value);
  });
    return { values: row };
  });
}

function getData(request) {
  // todo query size
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  var requestedFields = getFields(request).forIds(requestedFieldIds);

  var url = [
    'https://data.gov.sg/api/action/datastore_search?resource_id=',
    request.configParams.dataset,
    '&limit=10'
  ];
  var response = UrlFetchApp.fetch(url.join(''));
  var parsedResponse = JSON.parse(response).result.records;
  var rows = responseToRows(requestedFields, parsedResponse);

  return {
    schema: requestedFields.build(),
    rows: rows
  };
}
