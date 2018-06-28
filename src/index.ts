"use strict";

const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const firebase = require("firebase");

const serviceAccount = require("../polling-app-88df9-firebase-adminsdk-ze140-38b98b0911.json");

const config = {
  apiKey: "AIzaSyBHe3URdyc5xA_EODBULvZeryEOkJ1BIuE",
  authDomain: "polling-app-88df9.firebaseapp.com",
  databaseURL: "https://polling-app-88df9.firebaseio.com",
  projectId: "polling-app-88df9",
  storageBucket: "polling-app-88df9.appspot.com",
  messagingSenderId: "968428564609"
};

firebase.initializeApp(config);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://polling-app-88df9.firebaseio.com"
});

const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword
  }
});

const getUser = uid => admin.auth().getUser(uid);
const users = uid =>
  firebase
    .firestore()
    .collection("users")
    .doc(uid)
    .get();

const notifyUser = (uid, payload) =>
  users(uid)
    .then(function(doc) {
      const { fcmToken } = doc.data();
      console.log("got the token", fcmToken);
      return admin.messaging().sendToDevice([fcmToken], payload);
    })
    .catch(error => {
      console.error(error);
    });

exports.createMessage = functions.firestore
  .document("messages/{messageId}")
  .onWrite((change, context) => {
    // Get an object with the current document value.
    // If the document does not exist, it has been deleted.
    const document = change.after.exists ? change.after.data() : null;

    // Get an object with the previous document value (for update or delete)
    const oldDocument = change.before.data();

    const original = document.original;

    console.log("Make Uppercase", context.params.messageId, original);
    const uppercase = original.toUpperCase();

    change.after.ref.set(
      {
        uppercase
      },
      { merge: true }
    );

    const payload = {
      notification: {
        title: "You have creaed a new message!",
        body: `Your message was ${original}`
      }
    };

    console.log("author id is", document.authorId);

    return notifyUser(document.authorId, payload);
  });

exports.onNewVote = functions.firestore
  .document("polls/{messageId}/{messageCollectionId}/{docId}")
  .onWrite((change, context) => {
    // Get an object with the current document value.
    // If the document does not exist, it has been deleted.
    const document = change.after.exists ? change.after.data() : null;

    // Get an object with the previous document value (for update or delete)
    const oldDocument = change.before.data();

    console.log(
      "Changes",
      context.params.messageId,
      context.params.messageCollectionId,
      context.params.docId,
      document,
      oldDocument
    );

    const payload = {
      notification: {
        title: "Someone voted on your poll",
        body: `Your vote was ${context.params.docId}`
      }
    };

    return notifyUser(document.uid, payload);
  });

exports.mailer = functions.firestore
  .document("polls/{pollId}")
  .onCreate((snap, context) => {
    const newValue = snap.data();

    return getUser(newValue.authorId)
      .then(function(userRecord) {
        // See the UserRecord reference doc for the contents of userRecord.

        const userJSON = userRecord.toJSON;

        console.log("Showing", userRecord.email, userRecord.uid);

        console.log("Successfully fetched user data:", userJSON.email);

        const mailOptions = {
          from: '"Lessons abroad"',
          to: userRecord.email,
          subject: `your create a poll ${context.params.pollId}}`,
          text: "newValue.options"
        };
        return mailTransport
          .sendMail(mailOptions)
          .then(() => console.log(`message ${context.params.pollId}`))
          .catch(error =>
            console.error("There was an error while sending the email:", error)
          );
      })
      .catch(function(error) {
        console.log("Error fetching user data:", error);
      });
  });
