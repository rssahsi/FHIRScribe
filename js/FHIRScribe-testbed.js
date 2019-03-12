// FHIRScribe
//

// The 'dataMap; object keeps the data grabbed from the FHIR server organized.
// These values are made available to the resulting PDF
// based on the assignment structure in the master.json

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
      primary: '',
      home: '',
      work: '',
      mobile: '',
      email: ''
    }
  },
  contact: {
    name: {
      last: '',
      first: '',  
    },
    telecom: ''
  },
  user: {
    id: '',
    name: {
      first: '',
      fullgiven: '',
      last: '',
      suffix: '',
      text: '',
      complete: ''
    },
    pracRole: '',
  },
  allergies: ''
};

(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    // When the connection is established, read the FHIR resources.
    // Then extract the demographic information for the current patient, as well as about
    // the user making the request.
    // There are a smattering of other datapoints of interest which will be called as well.

    function onReady(smart)  {

      if (smart.hasOwnProperty('patient')) {
        // read the data in the 'patient' context
        var patient = smart.patient;
        var pt = patient.read();
        // identify the current user
        dataMap.user.id = smart.userId; 
        console.log ("Smart User Identification: " + dataMap.user.id);
        var userId = dataMap.user.id;
        var userIdSections = dataMap.user.id.split("/");

        // read the data in the 'user' context
        // note this information is grabbed from the user/*.* scope, that Cerner hates
        $.when (smart.api.read({ type: userIdSections[userIdSections.length-2], id: userIdSections[userIdSections.length-1]}))
          .done(function(userResult) {
            console.log("User Data Grab: " + JSON.stringify(userResult.data));
            console.log("");
            
                  /* wait! just how much shit is in that userResult.data object we fetched? */
                  //$.each( userResult.data, function (key, value) {
                  //  console.log ("User Data Parse: " + key + " : " + JSON.stringify(value));
                  //});
                  /* this is just debugging code */

            //assign user data to dataMap object
            dataMap.user.name.given = userResult.data.name.given;
            dataMap.user.name.last = userResult.data.name.family;
            dataMap.user.name.suffix = userResult.data.name.suffix;
            dataMap.user.name.complete = dataMap.user.name.given + " " + dataMap.user.name.last;
            
            //what if the logged in user is a patient, not practitioner?
            var user = {name: ""};
            if (userResult.data.resourceType === "Patient") {
              var patientName = userResult.data && userResult.data.name && userResult.data.name[0];
              user.name = patientName.given.join(" ") + " " + patientName.family.join(" ").trim();
                }
            user.id = userResult.data.id;
          });

          //read the AllergyIntolerances Data
          //
          $.when (smart.patient.api.fetchAll ({ 
              type: 'AllergyIntolerance'  
           }))
            .done(function(allergyResult) {
              console.log("");
              console.log("Allergy Data Grab: " + JSON.stringify(allergyResult.data));

            });
          
 
        // fetch the relevant data from the 'Observation' resource 
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

        // should we fetch some allergy data?

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

          // parse patient name data and assign to dataMap
          if (typeof patient.name[0] !== 'undefined') {   
            dataMap.patient.name.first = patient.name[0].given[0];
            dataMap.patient.name.fullgiven = patient.name[0].given.join(' ');
            dataMap.patient.name.last = patient.name[0].family.join(' ');
            dataMap.patient.name.complete = dataMap.patient.name.fullgiven + " " + dataMap.patient.name.last
          }

          // parse patient address data and assign to dataMap
          // this current presumes that the first address object is "home"
          // in future: we may need to iterate through multiple addresses to find 'home'
          if (typeof patient.address[0].city !== 'undefined') dataMap.patient.address.city = patient.address[0].city;
          if (typeof patient.address[0].line !== 'undefined') dataMap.patient.address.line = patient.address[0].line.join(', ');
          if (typeof patient.address[0].state !== 'undefined') dataMap.patient.address.state = patient.address[0].state;
          if (typeof patient.address[0].postalCode !== 'undefined') dataMap.patient.address.postalCode = patient.address[0].postalCode;         
          dataMap.patient.address.complete = dataMap.patient.address.line + ", " + dataMap.patient.address.city + ", " + dataMap.patient.address.state + " " + dataMap.patient.address.postalCode;

          // parse patient telecom data for telephone numbers
          // we need to iterate through multiple telecom objects and identify which are
          // 'system: phone' ... and assign them to dataMap by type
          $.each( patient.telecom, function (key, value) {
            if (typeof patient.telecom[key] !== 'undefined') {
              if (patient.telecom[key].system == "phone") {
                if (patient.telecom[key].use == "home") {
                  dataMap.patient.telecom.home = patient.telecom[key].value;                  
                } else if (patient.telecom[key].use == "mobile") {
                  dataMap.patient.telecom.mobile = patient.telecom[key].value;
                } else if (patient.telecom[key].use == "work") {
                  dataMap.patient.telecom.work = patient.telecom[key].value;
                }
              }
            } 
          });

          // set primary telephone number assuming home >> mobile >> work
          if (dataMap.patient.telecom.work !== '') {
            dataMap.patient.telecom.primary = dataMap.patient.telecom.work;
          }
          if (dataMap.patient.telecom.mobile !== '') {
            dataMap.patient.telecom.primary = dataMap.patient.telecom.mobile;
          }
          if (dataMap.patient.telecom.home !== '') {
            dataMap.patient.telecom.primary = dataMap.patient.telecom.home;
          }

          // to do : does the Patient resource provide an emergency contact?

          // this is where the observation data gets mapped to dataMap (to do)
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
          p.telecom = dataMap.patient.telecom.primary; // I added this
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
  // NOW ENTER SOME SERIOUS PDF FORM FUCKERY FTW!
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
      'ccc' : [dataMap.patient.telecom.primary],
      'ddd' : [dataMap.user.name.complete + " " + dataMap.user.name.suffix],
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

    // master connection subroutine for FHIR
    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

    

  };

  // floating functions beyond this point

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



