const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const AWS = require("aws-sdk");
// In production, set these in your environment variables
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: "us-east-1",
});
const ses = new AWS.SES();

// For demonstration: run every 2 minutes
exports.scheduledSendEmails = functions.pubsub
    .schedule("*/2 * * * *")
    .onRun(async (context) => {
        try {
            // 1) Find an active campaign
            const campaignsSnap = await db
                .collection("campaigns")
                .where("status", "==", true)
                .limit(1)
                .get();
            if (campaignsSnap.empty) {
                console.log("No active campaigns");
                return null;
            }
            const campaignDoc = campaignsSnap.docs[0];
            const campaignData = campaignDoc.data();
            console.log("Found campaign:", campaignDoc.id, campaignData.campaignName);

            // 2) Check time window
            // We'll assume the times are stored as "HH:MM" in schedule.
            // For real usage, also check daysOfWeek and timezone offset, etc.
            if (!campaignData.schedule) {
                console.log("No schedule defined, skipping...");
                return null;
            }
            const { startTime, endTime, daysOfWeek } = campaignData.schedule;
            // parse "HH:MM"
            const [startH, startM] = startTime.split(":").map(Number);
            const [endH, endM] = endTime.split(":").map(Number);

            const now = new Date();
            const nowHour = now.getHours();
            const nowMin = now.getMinutes();

            const nowTotal = nowHour * 60 + nowMin;         // e.g. 9:30 => 570
            const startTotal = startH * 60 + startM;        // e.g. "09:00" => 540
            const endTotal = endH * 60 + endM;              // e.g. "20:30" => 1230
            if (nowTotal < startTotal || nowTotal > endTotal) {
                console.log("Outside sending window, skipping...");
                return null;
            }

            // also check dayOfWeek if we want
            const dayNames = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ];
            const todayName = dayNames[now.getDay()];
            if (daysOfWeek && !daysOfWeek[todayName]) {
                console.log(`Today is ${todayName}, but schedule says no sending. Skipping...`);
                return null;
            }

            // 3) We need to pick an account in round-robin. Suppose we store a "lastAccountIndex" in the campaign doc?
            // If not present, default to 0.
            let lastIndex = campaignData.lastAccountIndex || 0;
            const accounts = campaignData.accounts || [];
            if (accounts.length === 0) {
                console.log("No accounts, skipping");
                return null;
            }

            // Move to the next account in a round-robin fashion
            let nextIndex = (lastIndex + 1) % accounts.length;
            let account = accounts[nextIndex];

            // If account usage or daily limit is reached, you might loop through to find one that has capacity, etc.
            if (account.usageToday >= account.dailyLimit) {
                console.log(`Account ${account.email} is at daily limit`);
                // skip or find next one
            }

            // also check nextSendTime if we want to enforce the interval
            const nowMs = Date.now();
            if (account.nextSendTime && nowMs < account.nextSendTime) {
                console.log("Not time to send yet for this account. Skipping...");
                return null;
            }

            // 4) Pick a lead that hasn't been emailed
            // e.g. leads that have a field campaign: [campaignData.campaignName], emailedAt: null
            const leadsSnap = await db
                .collection("leads")
                .where("campaign", "array-contains", campaignData.campaignName)
                .where("emailedAt", "==", null)
                .limit(1)
                .get();
            if (leadsSnap.empty) {
                console.log("No unsent leads left");
                return null;
            }
            const leadDoc = leadsSnap.docs[0];
            const leadData = leadDoc.data();

            // 5) Send with AWS SES
            const params = {
                Source: account.email, // from
                Destination: {
                    ToAddresses: [leadData.email],
                },
                Message: {
                    Subject: { Data: campaignData.emailSubject || "Hello from my campaign" },
                    Body: {
                        Text: {
                            Data: campaignData.emailBody || `Hello ${leadData.fullName}!`,
                        },
                    },
                },
            };
            await ses.sendEmail(params).promise();
            console.log("Email sent to", leadData.email);

            // 6) Mark lead as emailed
            await db.collection("leads").doc(leadDoc.id).update({
                emailedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 7) Update usage on the chosen account
            accounts[nextIndex].usageToday += 1;
            // set nextSendTime to e.g. now + 2 minutes ( or random 2–3 min).
            // If your front-end sets min=2, max=3, pick a random in that range:
            const randomGap = Math.floor(Math.random() * 2) + 2; // 2 or 3
            accounts[nextIndex].nextSendTime = nowMs + randomGap * 60 * 1000;

            // store lastAccountIndex
            await db.collection("campaigns").doc(campaignDoc.id).update({
                accounts,
                lastAccountIndex: nextIndex,
            });

            console.log("Lead updated, usage incremented, round-robin done.");
            return null;
        } catch (err) {
            console.error("Error in scheduledSendEmails:", err);
            return null;
        }
    });
