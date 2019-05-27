import * as firebase from '@firebase/testing'
import * as fs from 'fs'

const testName = 'firestore-local-emulator-test'
const rulesFilePath = 'firestore.rules'

describe(testName, () => {
    beforeAll(async () => {
        await firebase.loadFirestoreRules({
            projectId: testName,
            rules: fs.readFileSync(rulesFilePath, 'utf8')
        })
    })

    afterEach(async () => {
        await firebase.clearFirestoreData({ projectId: testName })
    })

    afterAll(async () => {
        await Promise.all(firebase.apps().map(app => app.delete()))
    })

    // users
    describe('users collection tests', () => {
        describe('read', () => {
            test('should let anyone read any profile', async () => {
                const db = authedApp(null)
                const user = usersRef(db).doc('alice')
                await firebase.assertSucceeds(user.get())
            })
        })

        describe('create', () => {
            test('require users to log in before creating a profile', async () => {
                const db = authedApp(null)
                const profile = usersRef(db).doc('alice')
                await firebase.assertFails(profile.set({ birthday: "January 1" }))
            })
            test('should enforce the createdAt date in user profiles', async () => {
                const db = authedApp({ uid: "alice" })
                const profile = db.collection("users").doc("alice")
                await firebase.assertFails(profile.set({ birthday: "January 1" }))
                await firebase.assertSucceeds(
                    profile.set({
                        birthday: "January 1",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                )
            })
            test('should only let users create their own profile', async () => {
                const db = authedApp({ uid: "alice" })
                await firebase.assertSucceeds(
                    db
                        .collection("users")
                        .doc("alice")
                        .set({
                            birthday: "January 1",
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        })
                )
                await firebase.assertFails(
                    db
                        .collection("users")
                        .doc("bob")
                        .set({
                            birthday: "January 1",
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        })
                )
            })
        })
    })

    // rooms
    describe('rooms collection tests', () => {
        describe('create', () => {
            test('should let anyone create a room', async () => {
                const db = authedApp({ uid: "alice" })
                const room = db.collection("rooms").doc("firebase")
                await firebase.assertSucceeds(
                    room.set({
                        owner: "alice",
                        topic: "All Things Firebase"
                    })
                )
            })
            test('should force people to name themselves as room owner when creating a room', async () => {
                const db = authedApp({ uid: "alice" })
                const room = db.collection("rooms").doc("firebase")
                await firebase.assertFails(
                    room.set({
                        owner: "scott",
                        topic: "Firebase Rocks!"
                    })
                )
            })
        })
        describe('update', () => {
            test('should not let one user steal a room from another user', async () => {
                const alice = authedApp({ uid: "alice" })
                const bob = authedApp({ uid: "bob" })

                await firebase.assertSucceeds(
                    bob
                        .collection("rooms")
                        .doc("snow")
                        .set({
                            owner: "bob",
                            topic: "All Things Snowboarding"
                        })
                )

                await firebase.assertFails(
                    alice
                        .collection("rooms")
                        .doc("snow")
                        .set({
                            owner: "alice",
                            topic: "skiing > snowboarding"
                        })
                )
            })
        })
    })
})

/// helper functions

function authedApp(auth: object): firebase.firestore.Firestore {
    return firebase
        .initializeTestApp({ projectId: testName, auth: auth })
        .firestore()
}

function adminApp(): firebase.firestore.Firestore {
    return firebase
        .initializeAdminApp({ projectId: testName })
        .firestore()
}

function usersRef(db: firebase.firestore.Firestore): firebase.firestore.CollectionReference {
    return db.collection('users')
}
