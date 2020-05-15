const axios = require("axios").default;
const cheerio = require("cheerio");

const admin = require("firebase-admin");

let serviceAccount = require("./firebase_secrets.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://novel-reader-250a9.firebaseio.com",
});

const siteUrl = "https://vipnovel.com/vipnovel/library-of-heavens-path/";

// Get a reference to the database service
let db = admin.firestore().collection("novels");

/**
 *
 * @param {string} name
 * @param {string} link
 */
function addToDb(name, link) {
  return db.add({
    name,
    link,
    dateNumber: new Date().getTime(),
  });
}

/** @typedef {object} Novel
 * @property {string} name
 * @property {string} link
 * @property {number} dateNumber
 */

/**
 * @returns {Promise<Novel[]>}
 */
async function getDbLinks() {
  const resPromises = await db.listDocuments();
  if (resPromises.length === 0) return [];
  const objects = await Promise.all(resPromises.map((x) => x.get()));
  return objects.filter((x) => !!x).map((x) => /**@type Novel */ (x.data()));
}

// Get cheerio data from siteUrl
const fetchData = async () => {
  const result = await axios.get(siteUrl);
  return cheerio.load(result.data);
};

async function getNewLinks() {
  const $ = await fetchData();
  /** @type {{link: string, name: string}[]} */
  const links = [];
  // Parse the 10 newest ones into links
  $(".wp-manga-chapter a[href]")
    .slice(0, 10)
    .each((_, x) => {
      const elem = $(x);
      links.push({ name: elem.text().trim(), link: elem.attr("href") });
    });
  return links;
}

async function updateDb() {
  const newLinksTask = getNewLinks();
  const dbLinksTask = getDbLinks();

  const newLinks = await newLinksTask;
  if (newLinks.length === 0) return -1;

  const oldLinks = await dbLinksTask;

  const diffLinks = newLinks.filter((x) =>
    oldLinks.every((y) => y.name !== x.name)
  );

  if (diffLinks.length === 0) return 1;
  await Promise.all(diffLinks.map((x) => addToDb(x.name, x.link)));
  return 1;
}

exports.handler = async (event) => {
  const ret = await updateDb();
  if (ret === -1) {
    const response = {
      statusCode: 400,
      body: JSON.stringify("Failed to find links"),
    };
    return response;
  }
  const response = {
    statusCode: 200,
    body: JSON.stringify("Hello from Lambda!"),
  };

  return response;
};
