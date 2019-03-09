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

      // additional test code
      //
      if (smart.hasOwnProperty('client')) {
        // read the data in the 'user' context
        var user = smart.clinet;
        var usr = client.read();

        $.each (user, function (key, value) {
          console.log ("UserId: " + client.user);
        });

        var p = defaultUser();
          p.birthdate = patient.birthDate;
          p.gender = patient.gender;
          p.firstname = pt_firstname;
          p.givenname = pt_fullgivenname;
          p.lastname = pt_lastname;
          p.telecom = telecom; // I added this
          p.address = address; // I added this
//          p.height = getQuantityValueAndUnit(height[0]);
         
          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          } 

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
      }





      if (smart.hasOwnProperty('patient')) {
        /* read the data in the 'patient' context */
        var patient = smart.patient;
        var pt = patient.read();

          /* wait! just how much shit is in that patient object we fetched? */
          $.each( patient, function (key, value) {
            console.log (key + ": " + JSON.stringify(value));
          });
          /* this is just debugging code */

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

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');

          /* compute patient name variables */

          var pt_firstname = ''; var pt_fullgivenname = ''; var pt_lastname = '';

          if (typeof patient.name[0] !== 'undefined') {   
            pt_firstname = patient.name[0].given[0];
            pt_fullgivenname = patient.name[0].given.join(' ');
            pt_lastname = patient.name[0].family.join(' ');
          }

          /* Presume the first address object is the only one that matters
             read the components and rearrange them into a single string. */
          /* in future: we may need to iterate through multiple addresses to find 'home' */

          var line = ''; var city = ''; var state = ''; var postalCode = '';
          if (typeof patient.address[0].city !== 'undefined') city = patient.address[0].city;
          if (typeof patient.address[0].line !== 'undefined') line = patient.address[0].line.join(', ');
          if (typeof patient.address[0].state !== 'undefined') state = patient.address[0].state;
          if (typeof patient.address[0].postalCode !== 'undefined') postalCode = patient.address[0].postalCode;         
          var address = line + ", " + city + ", " + state + " " + postalCode;

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
          p.firstname = pt_firstname;
          p.givenname = pt_fullgivenname;
          p.lastname = pt_lastname;
          p.telecom = telecom; // I added this
          p.address = address; // I added this
//          p.height = getQuantityValueAndUnit(height[0]);
         
          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          } 

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

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

  function defaultUser(){
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



