var connector = {};
connector.defaultDataset = 'age-distribution-of-cars';
connector.defaultLimit = '100';
connector.defaultOffset = '0';

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
  .setName('Enter the name of a dataset:')
  .setHelpText('Refer to https://data.gov.sg/dataset/ckan-package-list for full list of datasets.')
  .setPlaceholder(connector.defaultDataset);

  config.newTextInput()
  .setId('numRows')
  .setName('Maximum number of rows to return?  Leave blank to return all rows.')
  .setHelpText('Maximum number of rows to return, default is all rows')
  .setPlaceholder(connector.defaultLimit); 

  config.newTextInput()
  .setId('numOffset')
  .setName('Number of rows to offset?  Default is zero offset.')
  .setHelpText('Number of rows to offset.  If blank or greater than the total number of rows, this will default to zero.')
  .setPlaceholder(connector.defaultOffset);
  
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
  try {
    var response = UrlFetchApp.fetch(url.join(''));
  } catch (e) {
    DataStudioApp.createCommunityConnector()
      .newUserError()
      .setDebugText('Error - dataset not found: ' + request.configParams.dataset)
      .setText('The dataset \"' + request.configParams.dataset + '\" was not found on Data.gov.sg.')
      .throwException();
  }
  var parsedResponse = JSON.parse(response).result.resources[0].fields;
  var datasetID = JSON.parse(response).result.resources[0].id;
  var myfieldtype;
  var maxRows = 0;
  
  // TODO: add more datetime formats
  parsedResponse.forEach(function(x) {
  // get the fields
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
  // compute number of rows
    if (x["total"] > maxRows) {
      maxRows = x["total"];
    }
  });
  
  var rowsToReturn = parseInt(request.configParams.numRows,10);
  if (isNaN(rowsToReturn)) {
    rowsToReturn = maxRows;
  }
  
  // check that offset doesn't exceed number of rows
  var rowsOffset = parseInt(request.configParams.numOffset,10);
  if (rowsOffset >= maxRows || isNaN(rowsOffset)) {
    request.configParams.numOffset = 0;
  }
  
  request.configParams.dataset = datasetID;
  request.configParams.numRows = rowsToReturn;
  return myfields;
}

function getSchema(request) {
  // if dataset is undefined, go to the default dataset
  if (request.configParams.dataset === undefined) {
    request.configParams.dataset = connector.defaultDataset;
  }     
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
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  var requestedFields = getFields(request).forIds(requestedFieldIds);
 
  var url = [
    'https://data.gov.sg/api/action/datastore_search?resource_id=',
    request.configParams.dataset,
    '&limit=',
    request.configParams.numRows,
    '&offset=',
    request.configParams.numOffset
  ];
  var response = UrlFetchApp.fetch(url.join(''));
  var parsedResponse = JSON.parse(response).result.records;
  var rows = responseToRows(requestedFields, parsedResponse);

  return {
    schema: requestedFields.build(),
    rows: rows
  };
}