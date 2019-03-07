FHIR.oauth2.ready(function(smart) {

  // now do something cool

  var user = smart.user;
  var patient = smart.patient;

  spewoutput(patient)


});

function spewoutput(pt) {
  document.getElementById("holder").innerHTML ="<h2>" + "BAMF! " + pt.name + "</h2>""
}