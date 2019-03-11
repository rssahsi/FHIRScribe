// DataMap object that contains the structure of the internal variables
// will subsequently be mapped to the fields of the resulting PDF
// based on the structure in the master.json

var dataMap = {
  patient: {
    birthdate: '',
    gender: '',
    name: {
      first: '',
      fullgiven: '',
      last: '',
      complete: ''
    },
    address: {
      line: '',
      city: '',
      state: '',
      postalCode: '',
      complete: ''
    },
    telecom: {
      home: '';
      work: '';
      mobile: '',
      email: ''
    }
  }
};

(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    //
    // The goal here is to read the FHIR resource and extract the demographic information
    // for the current patient, as well as information about the user making the request.
    // If there are specific observations to transfer to the document, call them here as well
    //

    function onReady(smart)  {


      if (smart.hasOwnProperty('patient')) {
        /* read the data in the 'patient' context */
        var patient = smart.patient;
        var pt = patient.read();

        // read the data for the currently logged in user
        // this information is grabbed from the user/*.* context, that Cerner hates
        var userId = smart.userId; 
        console.log ("Smart User Identification:" + userId);
        var userIdSections = userId.split("/");

        $.when (smart.api.read({ type: userIdSections[userIdSections.length-2], id: userIdSections[userIdSections.length-1]}))
          .done(function(userResult) {
            console.log("User Data Grab: " + JSON.stringify(userResult.data));
            console.log("");
            
                  /* wait! just how much shit is in that userResult.data object we fetched? */
                  $.each( userResult.data, function (key, value) {
                    console.log ("User Data Parse: " + key + " : " + JSON.stringify(value));
                  });
                  /* this is just debugging code */

            var user = {name: ""};
              if (userResult.data.resourceType === "Patient") {
                var patientName = userResult.data && userResult.data.name && userResult.data.name[0];
                user.name = patientName.given.join(" ") + " " + patientName.family.join(" ").trim();
                }
              user.id = userResult.data.id;
              console.log ("Captured User Data:" + JSON.stringify(user) + "::" + userId);
              });
          
 
        /* fetch the relevant data from the 'Observation' resource */
                  var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });

                  /* wait! just how much shit is in that "smart" object we fetched? */
                  //$.each( smart, function (key, value) {
                  //  console.log ("Smart :" + key + ": " + JSON.stringify(value));
                  //});
                  /* this is just debugging code */

        $.when(pt, obv, userId).fail(onError);

        $.when(pt, obv, userId).done(function(patient, obv, userId) {
          var byCodes = smart.byCodes(obv, 'code');

                    /* wait! just how much shit is in that obv object we fetched? */
                    //$.each(obv, function (key, value) {
                    //  console.log ("Observations :" + key + ": " + JSON.stringify(value));
                    //});
                    /* this is just debugging code */

                    console.log("User Identification:" + userId);

          /* compute patient name variables */

          //dataMap.patient.firstname = '';
          //dataMap.patient.fullgivenname = '';
          //dataMap.patient.lastname = '';
          //var pt_firstname = ''; var pt_fullgivenname = ''; var pt_lastname = '';

          if (typeof patient.name[0] !== 'undefined') {   
            dataMap.patient.name.first = patient.name[0].given[0];
            dataMap.patient.name.fullgiven = patient.name[0].given.join(' ');
            dataMap.patient.name.last = patient.name[0].family.join(' ');
            dataMap.patient.name.complete = dataMap.patient.name.fullgiven + " " + dataMap.patient.name.last
          }

          /* Presume the first address object is the only one that matters
             read the components and rearrange them into a single string. */
          /* in future: we may need to iterate through multiple addresses to find 'home' */

          //var line = ''; var city = ''; var state = ''; var postalCode = '';
          if (typeof patient.address[0].city !== 'undefined') dataMap.patient.address.city = patient.address[0].city;
          if (typeof patient.address[0].line !== 'undefined') dataMap.patient.address.line = patient.address[0].line.join(', ');
          if (typeof patient.address[0].state !== 'undefined') dataMap.patient.address.state = patient.address[0].state;
          if (typeof patient.address[0].postalCode !== 'undefined') dataMap.patient.address.postalCode = patient.address[0].postalCode;         
          dataMap.patient.address.complete = dataMap.patient.address.line + ", " + dataMap.patient.address.city + ", " + dataMap.patient.address.state + " " + dataMap.patient.address.postalCode;

          /* Now we cobble together a sensible telephone number or two.
             We have to iterate through multiple telecom objects to find which are 
             "system: phone", and which is highest priority for a contact number.
             home >> mobile >> work >> other */

          var homenumber = '';
          var mobilenumber = '';

          $.each( patient.telecom, function (key, value) {
            if (typeof patient.telecom[key] !== 'undefined') {
              if (patient.telecom[key].system == "phone") {
                if (patient.telecom[key].use == "home") {
                  homenumber = patient.telecom[key].value;                  
                } else if (patient.telecom[key].use == "mobile") {
                  mobilenumber = patient.telecom[key].value;
                }
              }
            } 
            });

            var telecom = homenumber;
            if (homenumber == '') var telecom = mobilenumber;

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = patient.gender;
          p.firstname = dataMap.patient.name.first;
          p.givenname = dataMap.patient.name.fullgiven;
          p.lastname = dataMap.patient.name.last;
          p.telecom = telecom; // I added this
          p.address = dataMap.patient.address.complete; // I added this
//          p.height = getQuantityValueAndUnit(height[0]);
         
          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          } 

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);


  //
  // PDF Code Fuckery FTW
  //

  var oReq = new XMLHttpRequest();
  oReq.open("GET", "https://rssahsi.github.io/FHIRScribe/PDF/test.pdf", true);
  oReq.responseType = "arraybuffer";

  oReq.onload = function (oEvent) {
    var arrayBuffer = oReq.response;
    console.log(pdfform().list_fields(arrayBuffer));
    var fields = {
      'aaa' : [dataMap.patient.name.fullgiven + " " + dataMap.patient.name.last.toUpperCase()],
      'bbb' : [dataMap.patient.address.complete, 'betatwo'],
      'xxx' : 'this field does not exist',
      'ggg' : [true] // checkbox gonna checkbox
    };
  
    var out_buf = pdfform().transform(arrayBuffer, fields);
    var blob = new Blob([out_buf], {type: 'application/pdf'});
    saveAs(blob, 'generated.pdf');
      }
  oReq.send(null);



  



          ret.resolve(p);
        });
      } else {
        onError();
      }






    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

    

  };

  function defaultPatient(){
    return {
      firstname: {value: ''},
      givenname: {value: ''},
      lastname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      telecom: {value: ''},
      address: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''}, 
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }


  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.firstname);
    $('#lname').html(p.lastname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#address').html(p.address);
    $('#telecom').html(p.telecom);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp); 
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

})(window);



