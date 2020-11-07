import $ from 'jquery';
import * as Cookies from 'js-cookie';
import firebaseAuth from './firebase_config'
import { sha256 } from 'js-sha256';
import axios from "axios";
import io from "socket.io-client";
import AWS from 'aws-sdk';

//const URL = 'https://2020.battlecode.org';
//const URL = 'http://localhost:8000'; // DEVELOPMENT
// do not change URL here!! rather, for development, change it in ../.env.development
const URL = process.env.REACT_APP_BACKEND_URL;
const DONOTREQUIRELOGIN = false; // set to true for DEVELOPMENT
const LEAGUE = 0;
const PAGE_LIMIT = 10;
const db = firebaseAuth.firestore();
AWS.config.update({
  region: 'us-east-2',
  credentials: new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-east-2:4de05606-b5e2-4a25-a68f-f2cf2fd768e1'
  })
});
const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  params: {Bucket: 'se-battle'}
});

class Api {

  //----SUBMISSIONS----

  //uploads a new submission to the google cloud bucket
  static newSubmission(submissionfile, callback){

    //first check if robot name taken, if yes we dont even bother comiling
    var teamname = Cookies.get('team_name');
    var teamkey = Cookies.get('team_key');
    var executeThen=true;
    var uploadFailed=false;
    var dateNowInNum=Date.now();

    var subRef = db.collection("submissions").doc('robots');
    subRef.get().then(function(doc) {
      if (doc.exists) {
        var allSub=doc.data().submissions;
        allSub.find((o,i)=>{
          if (o.robot===submissionfile.name.slice(0,submissionfile.name.length-4) && o.teamname !== teamname){
            callback('robot name taken');
            executeThen=false;
            return
          }
        })
      } 
    }).then(function(){
      if(executeThen){
        callback('uploading')
        s3.upload({
          Key: teamkey+'date'+dateNowInNum+'-'+submissionfile.name,
          Body: submissionfile,
          ACL: 'public-read'
        }, function(err, data) {
          if(err) {
            uploadFailed=true;
            callback('upload failed, plz try again later');
            return
          }
          if (!uploadFailed){

            console.log('Successfully Uploaded!');

            //create pending status
            var teamRef=db.collection("teams").doc(Cookies.get('team_key'));
            teamRef.get().then(function(doc) {
            if (doc.exists) {
              var dateNowInReadable=Date(Date.now()).toString();
              

              var storageRef = firebaseAuth.storage().ref(teamname+'/'+dateNowInNum+submissionfile.name);
              storageRef.put(submissionfile).then(function(snapshot) {
                console.log('Uploaded a blob or file!');

                //store info to teams collection up to three submissions
                if(doc.data().submissions){
                  var allSubmissions = doc.data().submissions;
                    if(allSubmissions.length>=3){
                      allSubmissions.splice(2, allSubmissions.length-2);
                    }

                    allSubmissions.unshift({
                      name: submissionfile.name,
                      numDate: dateNowInNum,
                      readableDate: dateNowInReadable,
                      status: 'queuing'
                    });

                    teamRef.update({
                      submissions: allSubmissions
                    }).then(function(){
                      callback('uploaded')
                    }).catch(function(err){
                      console.log(err);
                    });
                  }
                  else{
                    var firstSubmission=[
                      {
                        name: submissionfile.name,
                        numDate: dateNowInNum,
                        readableDate: dateNowInReadable,
                        status: 'queuing'
                      }
                    ]

                    teamRef.update({
                        submissions: firstSubmission
                    }).then(function(){
                      callback('uploaded')
                    }).catch(function(err){
                      console.log(err);
                    });
                  }
                });
              } 
            })
          }
        }).on('httpUploadProgress', function (progress) {
          var uploaded = parseInt((progress.loaded * 100) / progress.total);
          $("progress").attr('value', uploaded);
        })
      }
    })

    
    /* //open socket to transfer file to server using buffer
        const socket = io('wss://sebattlecode.com:8000');
        //const socket = io('ws://localhost:8000');
        var reader = new FileReader();
        var rawData = new ArrayBuffer();

        reader.onload = function (e) {
          rawData = e.target.result;
          
          if (socket){
            callback('compiling')
            setTimeout(function(){
              if(!submitted)callback('queuing')
            },30000)
            
            socket.emit("send_message", {
              type: submissionfile.name.slice(0,submissionfile.name.length-4),
              data: rawData
            } , (result) => {
              if(!result){
                callback('compile failed')
                submitted=true
                return
              }*/

        
              
          
        //reader.readAsArrayBuffer(submissionfile);
    
    // submissionfile.append('_method', 'PUT');
    // get the url from the real api
    // $.post(`${URL}/api/${LEAGUE}/submission/`, {
    //   team: Cookies.get('team_id')
    // }).done((data, status) => {
    //   $.ajax({
    //     url: data['upload_url'], 
    //     method: "PUT",
    //     data: submissionfile,
    //     processData: false,
    //     contentType: false
    //   })
    // }).fail((xhr, status, error) => {
    //   console.log(error)
    //   callback('there was an error', false);
    // });
  }

  static downloadSubmission(name, numDate, callback) {
    if(Cookies.get('team_name')){
      var pathReference = firebaseAuth.storage().ref(Cookies.get('team_name')+'/'+numDate+name).getDownloadURL().then(function(url) {
        // `url` is the download URL for 'images/stars.jpg'
      
        callback(true);
        const aHelper = document.createElement('a');
        aHelper.style.display = 'none';
        aHelper.href = url;
        aHelper.download = `${name}.zip`;
        document.body.appendChild(aHelper);
        aHelper.click();
        window.URL.revokeObjectURL(url);
        callback(false);

      }).catch(function(error) {
        console.log(error);
        // Handle any errors
      });
    }
    /* $.get(`${URL}/api/${LEAGUE}/submission/${submissionId}/retrieve_file/`).done((data, status) => {
      // have to use fetch instead of ajax here since we want to download file
      fetch(data['download_url']).then(resp => resp.blob())
      .then(blob => {
        //code to download the file given by the url
        const objUrl = window.URL.createObjectURL(blob);
        const aHelper = document.createElement('a');
        aHelper.style.display = 'none';
        aHelper.href = objUrl;
        aHelper.download = `${fileNameAddendum}_battlecode_source.zip`;
        document.body.appendChild(aHelper);
        aHelper.click();
        window.URL.revokeObjectURL(objUrl);
      })
    }).fail((xhr, status, error) => {
      console.log(error)
      callback('there was an error', false);
    }); */
  }

  static downloadScrimmage(time, r1, r2, map) {
      firebaseAuth.storage().ref(time+r1+'-vs-'+r2+'-on-'+map+'.zip').getDownloadURL().then(function(url) {
        
        const aHelper = document.createElement('a');
        aHelper.style.display = 'none';
        aHelper.href = url;
        aHelper.target = "_blank";
        aHelper.download = `${r1}-vs-${r2}-on-${map}.bc20.zip`;
        document.body.appendChild(aHelper);
        aHelper.click();
        window.URL.revokeObjectURL(url); 

      }).catch(function(error) {
        console.log(error);
        // Handle any errors
      });
    
  }

  static getTeamSubmissions(callback) {
    if(Cookies.get('team_key')){
      db.collection("teams").doc(Cookies.get('team_key')).get().then(function(doc) {
        if (doc.exists) {
          if (doc.data().submissions){
            callback(doc.data().submissions);
          }
        } 
        }).catch(function(error) {
            console.log("Error getting document:", error);
        });
    }

    /* $.get(`${URL}/api/${LEAGUE}/teamsubmission/${Cookies.get("team_id")}/`).done((data, status) => {
        callback(data);
    }); */
  }

    static getSubmission(id, callback, callback_data) {
      
    // $.get(`${URL}/api/${LEAGUE}/submission/${id}/`).done((data, status) => {
    //     callback(callback_data, data);
    // });
  }


  static getCompilationStatus(callback) {
    /* $.get(`${URL}/api/${LEAGUE}/teamsubmission/${Cookies.get("team_id")}/team_compilation_status/`).done((data, status) => {
        callback(data);
    }); */
  }

  //----TEAM STATS---

  static getUpcomingDates(callback) {
    const newState = [
      { id: 0, date: 'hi', data: 'message' },
      { id: 1, date: '24', data: 'message2' },
    ];

    callback(newState);
  }

  // data from scrimmaging
  static getOwnTeamMuHistory(callback) {
    return Api.getTeamMuHistory(Cookies.get('team_key'), callback)
  }

  static getTeamMuHistory(team, callback) {
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    } // we should not require valid login for this. 

    $.get(`${URL}/api/${LEAGUE}/team/${team}/history/`).done((data, status) => {
        callback(data);
    });

    $.ajaxSetup({
      headers: { Authorization: `Bearer ${Cookies.get('token')}` },
    });
  }

  static getTeamWinStats(callback) {
    if (!Cookies.get('team_key')){
      callback([0,0])
    }
    else {
      return Api.getOtherTeamWinStats(Cookies.get('team_key'), callback)
    }
  }

  static getOtherTeamWinStats(team, callback) {

    db.collection("teams").doc(team).get().then(function(doc) {
      if (doc.exists) {
        callback([doc.data().won, doc.data().los])
      }
    })
    /* this.getTeamMuHistory(team, (data) => {
      let wins = 0
      let losses = 0
      data.forEach(entry => {
        if (entry.won) {
          wins++
        } else {
          losses++
        }
      })

      callback([wins, losses])
    }) */
  }


  //get data for team with team_id
  static getTeamById(team_id, callback) {
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    } // we should not require valid login for this. 

    $.get(`${URL}/api/${LEAGUE}/team/${team_id}/`).done((data, status) => {
        callback(data);
    });

    $.ajaxSetup({
      headers: { Authorization: `Bearer ${Cookies.get('token')}` },
    });
  }

  //calculates rank of given team, with tied teams receiving the same rank
  //i.e. if mu is 10,10,1 the ranks would be 1,1,3
  static getTeamRanking(team_id, callback) {
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    } // we should not require valid login for this. 

    const requestUrl = `${URL}/api/${LEAGUE}/team/${team_id}/ranking/`
    $.get(requestUrl).done((data, status) => {
      callback(data);
    })

    $.ajaxSetup({
      headers: { Authorization: `Bearer ${Cookies.get('token')}` },
    });
  }

  //----GENERAL INFO----

  static getLeague(callback) {
    $.get(`${URL}/api/league/${LEAGUE}/`).done((data, status) => {
      Cookies.set('league_url', data.url);
      $.get(data.url).done((data, success) => {
        callback(data);
      }).fail((xhr, status, error) => {
        console.log(error);
      });
    });
  }

  static getUpdates(callback) {
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    } // we should not require valid login for this. 
    $.get(`${URL}/api/league/${LEAGUE}/`, (data, success) => {
      for (let i = 0; i < data.updates.length; i++) {
        const d = new Date(data.updates[i].time);
        data.updates[i].dateObj = d
        data.updates[i].date = d.toLocaleDateString();
        data.updates[i].time = d.toLocaleTimeString();
      }

      callback(data.updates);
    });
    $.ajaxSetup({
      headers: { Authorization: `Bearer ${Cookies.get('token')}` },
    });
  }

  //----SEARCHING----

  static search(query, callback) {
    const encodedQuery = encodeURIComponent(query);
    const teamUrl = `${URL}/api/${LEAGUE}/team/?search=${encodedQuery}&page=1`;
    const userUrl = `${URL}/api/user/profile/?search=${encodedQuery}&page=1`;
    $.get(teamUrl, (teamData) => {
      $.get(userUrl, (userData) => {
        const teamLimit = parseInt(teamData.count / PAGE_LIMIT, 10) + !!(teamData.count % PAGE_LIMIT);
        const userLimit = parseInt(userData.count / PAGE_LIMIT, 10) + !!(userData.count % PAGE_LIMIT);
        callback({
          users: userData.results,
          userLimit,
          userPage: 1,
          teams: teamData.results,
          teamLimit,
          teamPage: 1,
        });
      });
    });
  }
  static searchTeamRanking(query, page, callback) {
    var teams=[];
    
    db.collection("teams")
    .get()
    .then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
          teams.push(doc.data());
            // doc.data() is never undefined for query doc snapshots
          //console.log(doc.id, " => ", doc.data());
        });
        teams.sort(function(a, b){
          return b.score-a.score
        })
        callback({teams});
    })
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });
    //Api.searchRanking(`${URL}/api/${LEAGUE}/team`, query, page, callback)
  }

  static searchStaffOnlyRanking(query, page, callback) {
    Api.searchRanking(`${URL}/api/${LEAGUE}/team`, query, page, callback)
  }

  static searchRanking(apiURL, query, page, callback) {
    const encQuery = encodeURIComponent(query);
    const teamUrl = `${apiURL}/?ordering=-score,name&search=${encQuery}&page=${page}`;
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    } // we should not require valid login for this. 
    $.get(teamUrl, (teamData) => {
      const teamLimit = parseInt(teamData.count / PAGE_LIMIT, 10) + !!(teamData.count % PAGE_LIMIT);
      callback({
        query,
        teams: teamData.results,
        teamLimit,
        teamPage: page,
      });
    });
    $.ajaxSetup({
      headers: { Authorization: `Bearer ${Cookies.get('token')}` },
    }); // re-add the authorization info
  }

  static searchTeam(query, page, callback) {
    const encQuery = encodeURIComponent(query);
    const teamUrl = `${URL}/api/${LEAGUE}/team/?search=${encQuery}&page=${page}`;
    $.get(teamUrl, (teamData) => {
      const teamLimit = parseInt(teamData.count / PAGE_LIMIT, 10) + !!(teamData.count % PAGE_LIMIT);
      callback({
        query,
        teams: teamData.results,
        teamLimit,
        teamPage: page,
      });
    });
  }

  static searchUser(query, page, callback) {
    const encQuery = encodeURIComponent(query);
    const userUrl = `${URL}/api/user/profile/?search=${encQuery}&page=${page}`;
    $.get(userUrl, (userData) => {
      callback({
        userPage: page,
        users: userData.results,
      });
    });
  }

  //---TEAM INFO---

  static getUserTeam(callback) {

    if(!Cookies.get('team_key')){
      var user = firebaseAuth.auth().currentUser;
      var userEmail=null;

      if (user != null) {
        user.providerData.forEach(function (profile) {
          userEmail=profile.email;
          Cookies.set('user_email', userEmail);
        });
      }

      if (userEmail != null){
        var docRef = db.collection("users").doc(userEmail);

        docRef.get().then(function(doc) {
            if (doc.exists) {

              db.collection("teams").doc(doc.data().team_key).get().then(function(doc) {
                
                if (doc.exists) {
                  Cookies.set('team_key', doc.data().team_key);
                  Cookies.set('team_name', doc.data().name);
                  callback(doc.data());
                } else {
                    // doc.data() will be undefined in this case
                    console.log("Not in team sorry");
                    callback(null);
                }
                }).catch(function(error) {
                    console.log("Error getting document:", error);
                    callback(null);
                });
            }
            else {
                // doc.data() will be undefined in this case
                db.collection('users').doc(userEmail).set({
                  teamname: '',
                  team_key: ''
                }).catch(function(error) {
                    console.error("Error adding document: ", error);
                });
                console.log("Not in team sorry");
                callback(null);
            }
            
        }).catch(function(error) {
            console.log("Error getting document:", error);
            callback(null);
        });
      }
    }
    else{
      db.collection("teams").doc(Cookies.get('team_key')).get().then(function(doc) {
        if (doc.exists) {   
            callback(doc.data());
        } else {
            // doc.data() will be undefined in this case
            console.log("Not in team sorry");
            callback(null);
        }
        }).catch(function(error) {
            console.log("Error getting document:", error);
            callback(null);
        });
    }
    /* $.get(`${URL}/api/userteam/${encodeURIComponent(Cookies.get('username'))}/${LEAGUE}/`).done((data, status) => {
      Cookies.set('team_id', data.id);
      Cookies.set('team_name', data.name);

      $.get(`${URL}/api/${LEAGUE}/team/${data.id}/`).done((data, status) => {
        callback(data);
      });
    }).fail((xhr, status, error) => {
      // possibly dangerous???
      callback(null);
    }); */
  }

  // updates team
  static updateTeam(params, callback) {

    console.log(params);
    var cityRef = db.collection('teams').doc(params.id);

    // Remove the 'capital' field from the document
    var removeCapital = cityRef.update({
        bio: params.bio
    }).then(function(){
      callback(true);
    }).catch(function(err){
      console.log(err);
      callback(false);
    });
    // $.ajax({
    //   url: `${URL}/api/${LEAGUE}/team/${Cookies.get('team_id')}/`,
    //   data: JSON.stringify(params),
    //   type: 'PATCH',
    //   contentType: 'application/json',
    //   dataType: 'json',
    // }).done((data, status) => {
    //   
    // }).fail((xhr, status, error) => {
    //   callback(false);
    // });
  }

  //----USER FUNCTIONS----

  static createTeam(team_name, callback) {

    var userEmail=null;
    var teamCode=sha256(team_name);

    var docRef = db.collection("teams").doc(teamCode);
      docRef.get().then(function(doc) {
          if (doc.exists) {
            callback(false);
          } 
          else {
            if (!Cookies.get('user_email')){
              var user = firebaseAuth.auth().currentUser;
              
              if (user != null) {
                user.providerData.forEach(function (profile) {
                  userEmail=profile.email;
                  Cookies.set('user_email', userEmail);
                });
              }
            }
        
            userEmail=Cookies.get('user_email');
        
            if (userEmail!=null){
              db.collection('users').doc(userEmail).set({
                teamname: team_name,
                team_key: teamCode
              }).then(function(docRef) {
                console.log("Document written with ID: ", docRef);
              })
              .catch(function(error) {
                  console.error("Error adding document: ", error);
                  callback(false);
              });
        
              if(teamCode !=null){
                db.collection('teams').doc(teamCode).set({
                  name: team_name,
                  users: [userEmail],
                  team_key: teamCode,
                  id:teamCode,
                  auto_accept_ranked:false,
                  auto_accept_unranked:false,
                  bio:'',
                  avator:'',
                  score:1200,
                  won: 0,
                  los: 0
                }).then(function(docRef) {
                  Cookies.set('team_key', teamCode);
                  Cookies.set('team_name', team_name);
                  callback(true);
                })
                .catch(function(error) {
                    console.error("Error adding document: ", error);
                    callback(false);
                });
              };
            }
        
          }
      });

    

    /* $.post(`${URL}/api/${LEAGUE}/team/`, { name: team_name }).done((data, status) => {
      Cookies.set('team_id', data.id);
      Cookies.set('team_name', data.name);
      callback(true);
    }).fail((xhr, status, error) => {
      callback(false);
    }); */
  }

  static joinTeam(secret_key, team_name, callback) {

    if(secret_key!==sha256(team_name)){
      callback(false);
    }

    var user = firebaseAuth.auth().currentUser;
    var userEmail;
    var teamUsers;

    if (user !== null) {
      user.providerData.forEach(function (profile) {
        userEmail=profile.email;
        Cookies.set('user_email', userEmail);
        
      });
    }

    if (userEmail != null){
      var docRef = db.collection("teams").doc(secret_key);
      docRef.get().then(function(doc) {
          if (doc.exists) {
              if (team_name === doc.data().name){
                teamUsers=doc.data().users;
                const index = teamUsers.indexOf(userEmail);
                if (index === -1) {
                  teamUsers.push(userEmail);
                  docRef.update({
                      users: teamUsers
                  });
                }

                db.collection("users").doc(userEmail).update({
                  teamname: team_name,
                  team_key: secret_key
                }).then(function(){
                  Cookies.set('team_key', secret_key);
                  Cookies.set('team_name', team_name);
                  callback(true);
                });
              }
              else {
                callback(false);
              }
              console.log("Document data:", doc.data());
          } else {
              // doc.data() will be undefined in this case
              console.log("No such document!");
              callback(false);
          }
      }).catch(function(error) {
          console.log("Error getting document:", error);
          callback(false);
      });
    }

    // $.get(`${URL}/api/${LEAGUE}/team/?search=${encodeURIComponent(team_name)}`, (team_data, team_success) => {
    //   let found_result = null
    //   team_data.results.forEach(result => {
    //     if (result.name === team_name) {
    //       found_result = result
    //     }
    //   })
    //   if (found_result === null) return callback(false);
    //   $.ajax({
    //     url: `${URL}/api/${LEAGUE}/team/${found_result.id}/join/`,
    //     type: 'PATCH',
    //     data: { team_key: secret_key },
    //   }).done((data, status) => {
    //     Cookies.set('team_id', data.id);
    //     Cookies.set('team_name', data.name);
    //     callback(true);
    //   }).fail((xhr, status, error) => {
    //     callback(false);
    //   });
    // });
  }

  static leaveTeam(callback) {

            db.collection('users').doc(Cookies.get('user_email')).update({
                teamname: '',
                team_key: ''
            }).then(function(){
              var team_key=Cookies.get('team_key')
              Cookies.set('team_key', null);
              Cookies.set('team_name', null);

              db.collection("teams").doc(team_key).get().then(function(doc) {
                if (doc.exists) {
                    var teamUsers=doc.data().users;
  
                    const index = teamUsers.indexOf(Cookies.get('user_email'));
                    if (index > -1) {
                      teamUsers.splice(index, 1);
                    }
  
                    db.collection('teams').doc(team_key).update({
                      users: teamUsers
                    }).then(function() {
                      console.log("Document successfully updated!");
                      callback(true);
                    })
                    .catch(function(error) {
                        // The document probably doesn't exist.
                        console.error("Error updating document: ", error);
                    });
                } else {
                    // doc.data() will be undefined in this case
                    console.log("No such document!");
                    callback(false);
                }
              }).catch(function(error) {
                  console.log("Error getting document:", error);
                  callback(false);
              });
            });

            


    // $.ajax({
    //   url: `${URL}/api/${LEAGUE}/team/${Cookies.get('team_id')}/leave/`,
    //   type: 'PATCH',
    // }).done((data, status) => {
    //   callback(true);
    // }).fail((xhr, status, error) => {
    //   callback(false);
    // });
  }

  static getUserProfile(callback) {
    //Api.getProfileByUser(Cookies.get('username'), Api.setUserUrl(callback))
  }

  // essentially like python decorator, wraps 
  // sets user url before making call to that endpoint and passing on to callback
  static setUserUrl(callback) {
  	return function (data) {
  		Cookies.set('user_url', data.url);
  		$.get(data.url).done((data, success) => {
        callback(data);
      }).fail((xhr, status, error) => {
        console.log(error);
      });
  	}
  }

  static getProfileByUser(username, callback) {
  	if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    } // we should not require valid login for this. 
    
    $.get(`${URL}/api/user/profile/${username}/`).done((data, status) => {
    	callback(data);
    }).fail((xhr, status, error) => {
        console.log(error);
    });

    $.ajaxSetup({
      headers: { Authorization: `Bearer ${Cookies.get('token')}` },
    });

  }

  static updateUser(profile, callback) {
    $.ajax({
      url: Cookies.get('user_url'),
      data: JSON.stringify(profile),
      type: 'PATCH',
      contentType: 'application/json',
      dataType: 'json',
    }).done((data, status) => {
      callback(true);
    }).fail((xhr, status, error) => {
      callback(false);
    });
  }

  static resumeUpload(resume_file, callback) {
    $.get(`${Cookies.get('user_url')}resume_upload/`, (data, succcess) => {
      $.ajax({
        url: data['upload_url'], 
        method: "PUT",
        data: resume_file,
        processData: false,
        contentType: false
      })
    });
  }

  //----SCRIMMAGING----

  static acceptScrimmage(scrimmage_id, callback) {
    $.ajax({
      url: `${URL}/api/${LEAGUE}/scrimmage/${scrimmage_id}/accept/`,
      method: 'PATCH',
    }).done((data, status) => {
      callback(true);
    }).fail((xhr, status, error) => {
      callback(false);
    });
  }

  static rejectScrimmage(scrimmage_id, callback) {
    $.ajax({
      url: `${URL}/api/${LEAGUE}/scrimmage/${scrimmage_id}/reject/`,
      method: 'PATCH',
    }).done((data, status) => {
      callback(true);
    }).fail((xhr, status, error) => {
      callback(false);
    });
  }

  static getScrimmageRequests(callback) {
    this.getAllTeamScrimmages((scrimmages) => {
      const requests = scrimmages.filter((scrimmage) => {
        if (scrimmage.status !== 'pending') {
          return false;
        }
        if (scrimmage.blue_team === scrimmage.red_team) {
          return true;
        }
        return scrimmage.requested_by !== parseInt(Cookies.get('team_id'), 10);
      }).map((scrimmage) => {
        const { blue_team, red_team } = scrimmage;
        return {
          id: scrimmage.id,
          team_id: scrimmage.requested_by,
          team: (Cookies.get('team_name') === red_team) ? blue_team : red_team,
        };
      });
      callback(requests);
    });
  }

  static requestScrimmage(teamId, callback) {
    $.post(`${URL}/api/${LEAGUE}/scrimmage/`, {
      red_team: Cookies.get('team_id'),
      blue_team: teamId,
      ranked: false,
    }).done((data, status) => {
      callback(teamId, true);
    }).fail(() => {
      callback(teamId, false);
    });
  }

  

  static getAllTeamScrimmages(callback) {
    db.collection("submissions").doc('gameResults').get().then(function(doc) {
      if (doc.exists) {
        callback(doc.data().scrimmages)
      }
    })
  }

  static getScrimmageHistory(callback) {
    //const my_id = parseInt(Cookies.get('team_id'), 10);
    var myTeam = Cookies.get('team_name');
    this.getAllTeamScrimmages((s) => {
      const requests = [];
      for (let i = 0; i < s.length; i++) {
        if (s[i].TEAMA!==myTeam && s[i].TEAMB!==myTeam) continue;
        const on_red = s[i].TEAMA === myTeam;
        //if (s[i].status === 'pending' && s[i].requested_by !== my_id) continue;

        if (s[i].STATUS === 'Awon') s[i].STATUS = on_red ? 'won' : 'lost';
        else if (s[i].STATUS === 'Bwon') s[i].STATUS = on_red ? 'lost' : 'won';

        //if (s[i].STATUS !== 'lost' && s[i].STATUS !== 'won') {
        //  s[i].REPLAY = undefined;
        //}
        //s[i].status = s[i].status.charAt(0).toUpperCase() + s[i].status.slice(1);
        //s[i].date = new Date(s[i].updated_at).toLocaleDateString();
        //s[i].time = new Date(s[i].updated_at).toLocaleTimeString();
        s[i].ENEMY = on_red ? s[i].TEAMB : s[i].TEAMA;
        //s[i].color = on_red ? 'Red' : 'Blue';
        console.log(s[i])
        requests.push(s[i]);
        
      } callback(requests);
    });
  }

  static calculateElo(){

    var allTeam = [];
    var allScri = [];

    //get all scrimmages
    db.collection("submissions").doc('gameResults').get().then(function(doc) {
      if (doc.exists && doc.data().scrimmages) {
        var s=doc.data().scrimmages
        //allScri is for store changed gameResults; s is for loop gameResults
        allScri=s

        //get all teams info store in allTeam
        db.collection("teams")
        .get()
        .then(function(querySnapshot) {
            querySnapshot.forEach(function(doc) {
              allTeam.push(doc.data());
            });
            
            //now all team info ready
            s.find((o,i)=>{
              if (o.Elo===false){
                //Elo equals to false means havent calculated yet
                var won = (o.STATUS === 'Awon')? o.TEAMA : (o.STATUS === 'Bwon')? o.TEAMB : '';
                var los = (o.STATUS === 'Awon')? o.TEAMB : (o.STATUS === 'Bwon')? o.TEAMA : '';
                
                var wonIndex;
                var losIndex;
                allTeam.find((o, i) => {
                  if (o.name === won) {
                      wonIndex=i
                      
                      return true; // stop searching
                  }
                });
                allTeam.find((o, i) => {
                  if (o.name === los) {
                      losIndex=i
                      return true; // stop searching
                  }
                });

                if (wonIndex!==null && losIndex!==null && allTeam[losIndex] && allTeam[wonIndex]){
                  var probW = 1.0 * 1.0 / (1 + 1.0 * Math.pow(10, 1.0 * (allTeam[losIndex].score - allTeam[wonIndex].score) / 400))  
                  var probL = 1 - probW   
                  allTeam[wonIndex].score += 32 * (1 - probW)
                  allTeam[losIndex].score += 32 * (0 - probL)
                  allTeam[wonIndex].won += 1
                  allTeam[losIndex].los += 1

                  allScri.splice(i,1,{
                    DATE: s[i].DATE,
                    DATESTORE: s[i].DATESTORE,
                    Elo: true,
                    MAP: s[i].MAP,
                    REPLAY: s[i].REPLAY,
                    ROBOTA: s[i].ROBOTA,
                    ROBOTB: s[i].ROBOTB,
                    STATUS: s[i].STATUS,
                    TEAMA: s[i].TEAMA,
                    TEAMB: s[i].TEAMB,
                    TIME: s[i].TIME
                  }); 
                }
                
              }
            })

            db.collection("submissions").doc('gameResults').update({
              scrimmages: allScri
            }).catch(function(err){
              console.log(err);
            });

            for (var i = 0; i < allTeam.length; i++) {
              db.collection("teams").doc(sha256(allTeam[i].name)).update({
                won: allTeam[i].won,
                score: Math.ceil(allTeam[i].score),
                los: allTeam[i].los
              })
            }
        })
      } 
    })
  }

  //----REPLAYS?-----

  static getReplayFromURL(url, callback) {
    // If `https` not in current url, replace `https` with `http` in above
    if (window.location.href.indexOf('http://') > -1) {
      url = url.replace('https://', 'http://');
    }

    const oReq = new XMLHttpRequest();
    oReq.open('GET', url, true);
    oReq.responseType = 'arraybuffer';

    oReq.onload = function (oEvent) {
      callback(new Uint8Array(oReq.response));
    };

    oReq.send();

    // If `https` not in current url, replace `https` with `http` in above
    if (window.location.href.indexOf('http://') > -1) {
      url = url.replace('https://', 'http://');
    }

    $.get(url, (replay, super_sucess) => {
      $.ajaxSetup({
        headers: { Authorization: `Bearer ${Cookies.get('token')}` },
      });

      callback(replay);
    });
  }

  //----TOURNAMENTS----

  static getNextTournament(callback) {
    // TODO: actually use real API for this
    callback({
      "est_date_str": '7 PM EST on January 29, 2020',
      "seconds_until": (Date.parse(new Date('January 29, 2020 19:00:00')) - Date.parse(new Date())) / 1000,
      "tournament_name": "Final Tournament, High School Tournament and Newbie Tournament"
    });
    // callback({
    //   "est_date_str": '7 PM EST on January 23, 2020',
    //   "seconds_until": (Date.parse(new Date('January 23, 2020 19:00:00')) - Date.parse(new Date())) / 1000,
    //   "tournament_name": "International Qualifying Tournament"
    // });
    // callback({
    //   "est_date_str": '7 PM EST on January 20, 2020',
    //   "seconds_until": (Date.parse(new Date('January 20, 2020 19:00:00')) - Date.parse(new Date())) / 1000,
    //   "tournament_name": "Seeding Tournament"
    // });
    // callback({
    //   "est_date_str": '7 PM EST on January 6, 2020',
    //   "seconds_until": (Date.parse(new Date('January 6, 2020 19:00:00')) - Date.parse(new Date())) / 1000,
    //   "tournament_name": "START"
    // });
  }

  static getTournaments(callback) {
    // const tournaments = [
    //   { name: 'sprint', challonge: 'bc20_sprint', blurb: 'Congrats to <a href="rankings/1158">Bruteforcer</a> for winning the Sprint tournament!'},
    //   { name: 'seeding', challonge: 'bc20_seeding', blurb: 'Join us on <a href="https://twitch.tv/mitbattlecode">Twitch</a> starting at 3 pm for a livestream starting from the winners round of 32!'},
    // ];

    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    } // we should not require valid login for this. 
    $.get(`${URL}/api/${LEAGUE}/tournament/`).done((data, status) => {
      console.log(data);
      callback(data.results);
  });

    // callback(tournaments);
  }

  //----AUTHENTICATION----

  static checkCookies(user_email) {
    if (Cookies.get('user_email') && Cookies.get('user_email')!==user_email) {
      Cookies.remove('user_email')
      if (Cookies.get('team_key')){
        Cookies.remove('team_key')
      }
      if (Cookies.get('team_name')){
        Cookies.remove('team_name')
      }
    }
  }

  static logout(callback) {
    Cookies.set('token', '');
    Cookies.set('refresh', '');
    callback();
  }

  static loginCheck(callback) {
    if (DONOTREQUIRELOGIN) {
      callback(true);
      return;
    }
    $.ajaxSetup({
      headers: { Authorization: `Bearer ${Cookies.get('token')}` },
    });

    $.post(`${URL}/auth/token/verify/`, {
      token: Cookies.get('token'),
    }).done((data, status) => {
      callback(true);
    }).fail((xhr, status, error) => {
      callback(false);
    });
  }

  static verifyAccount(registrationKey, callback) {
    const userId = encodeURIComponent(Cookies.get('username'));
    $.post(`${URL}/api/verify/${userId}/verifyUser/`,
      {
        registration_key: registrationKey,
      }, (data, success) => { callback(data, success); });
  }


  static login(username, password, callback) {
    $.post(`${URL}/auth/token/`, {
      username,
      password,
    }).done((data, status) => {
      Cookies.set('token', data.access);
      Cookies.set('refresh', data.refresh);
      Cookies.set('username', username);

      $.ajaxSetup({
        headers: { Authorization: `Bearer ${Cookies.get('token')}` },
      });

      callback(data, true);
    }).fail((xhr, status, error) => {
      console.log(xhr);
      // if responseJSON is undefined, it is probably because the API is not configured
      // check that the API is indeed running on URL (localhost:8000 if local development)
      callback(xhr.responseJSON.detail, false);
    });
  }

  static register(email, username, password, first, last, dob, callback) {
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    }

    $.post(`${URL}/api/user/`, {
      email,
      username,
      password,
      first_name: first,
      last_name: last,
      date_of_birth: dob,
    }).done((data, status) => {
      this.login(username, password, callback);
    }).fail((xhr, status, error) => {
      if (xhr.responseJSON.username) callback(xhr.responseJSON.username, false);
      else if (xhr.responseJSON.email) callback(xhr.responseJSON.email, false);
      else { callback('there was an error', false); }
    });
  }

  static doResetPassword(password, token, callback) {
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    }

    // console.log("calling api/password_reset/reset_password/confirm");
    console.log("calling api/password_reset/confirm");
    // console.log("with pass", password, "token", token);
    
    var req = {
      password: password,
      token: token,
    };

    $.post(`${URL}/api/password_reset/confirm/`, req, 
    (data, success) => { callback(data, success); }).fail((xhr, status, error) => {console.log("call to api/password_reset/reset_password/confirm failed")});
  }

  static forgotPassword(email, callback) {
    if ($.ajaxSettings && $.ajaxSettings.headers) {
      delete $.ajaxSettings.headers.Authorization;
    }
    $.post(`${URL}/api/password_reset/`,
      {
        email,
      }, (data, success) => { callback(data, success); });
  }

  static pushTeamCode(code, callback) {
    this.updateTeam({ code }, callback);
  }
}

export default Api;
