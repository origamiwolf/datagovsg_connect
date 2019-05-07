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

// this needs to be more intelligent.  So far only numbers can be identified, everything else needs to be manually typed
  
  parsedResponse.forEach(function(x) {
    switch(x["type"]) {
      case "numeric":
        myfields.newMetric()
        .setId(x["name"])
        .setType(types.NUMBER)
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
      Logger.log(field.getId());      
      row.push(getRowData[field.getId()]);
      Logger.log(row);
  });
    return { values: row };
  });
}

function getData(request) {
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  var requestedFields = getFields(request).forIds(requestedFieldIds);
  
  var url = [
    'https://data.gov.sg/api/action/datastore_search?resource_id=',
    request.configParams.dataset
  ];
  var response = UrlFetchApp.fetch(url.join(''));
  var parsedResponse = JSON.parse(response).result.records;
  var rows = responseToRows(requestedFields, parsedResponse);
  
  return {
    schema: requestedFields.build(),
    rows: rows
  };
}

