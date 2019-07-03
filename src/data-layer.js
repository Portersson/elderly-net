const dbFile = './.data/sqlite.db'
const Database = require('better-sqlite3')
const db = new Database(dbFile, { verbose: console.log })

initTable("articles", 
          `article_id INTEGER PRIMARY KEY, submitter_id TEXT, title TEXT,
           url TEXT, description TEXT, image_url TEXT,
           points INTEGER, timestamp TEXT`
         )
initTable("tags", "tag_id INTEGER PRIMARY KEY, label TEXT UNIQUE")

initTable("tagmap", "article_id INTEGER, tag_id INTEGER, FOREIGN KEY (article_id) REFERENCES articles (article_id), FOREIGN KEY (tag_id) REFERENCES tags (tag_id)")

initTable("users", "submitter_id TEXT UNIQUE, name TEXT")

/*
 * Public methods
 */

const getArticles = (tags="") => {
  const isInclusiveSearch = /OR|\|/.test(tags)
  tags = tags.split(/[|,]|AND|OR/).map(tag => tag.trim() + '%')
  const matches = []
  
  const findMatches = db.transaction(() => {
    const stmt = db.prepare(`SELECT * FROM articles
                             LEFT JOIN tagmap ON tagmap.article_id=articles.article_id
                             LEFT JOIN tags   ON tagmap.tag_id=tags.tag_id
                             LEFT JOIN users  ON users.submitter_id=articles.submitter_id
                             WHERE tags.label LIKE ? ${"OR tags.label LIKE ? ".repeat(tags.length-1)}
                             GROUP BY articles.article_id
                             HAVING count(*) >= ${isInclusiveSearch ? 0 : tags.length} 
                             ORDER BY points
                             DESC LIMIT 20`)
    const articles = stmt.all(...tags)
    for (const article of articles) {
      article.tags = getArticleTags(article.article_id)
      matches.push(article)
  }})
  findMatches()
  printAll()
  return matches 
}

const getTags = (patterns = [""]) => {
  let tags = []
  const stmt = db.prepare('SELECT label FROM tags WHERE label LIKE ? LIMIT 20')
  const searchMany = db.transaction((patterns) => {
    for (const pattern of patterns) {
      const results = stmt.all(pattern)
      tags.push(getValuesOf(results))
    }
  })
  searchMany(patterns)
  return tags
}

const insertArticle = (slackId, title, url, description, image, name, tags=null) => {
  let article = {}
  article.timestamp = Date.now()
  article.points = 0
  article.url = url
  article.submitterId = slackId
  article.title = title
  article.description = description
  article.image_url = image
  article.tags = JSON.stringify(tags)
  const columns = "submitter_id, title, url, description, image_url, points, timestamp"
  const bindings = "@submitterId, @title, @url, @description, @image_url, @points, @timestamp"
  insertUser(slackId, name)
  const stmt = db.prepare(`INSERT INTO articles (${columns}) VALUES (${bindings})`)
  const articleId = stmt.run(article).lastInsertRowid
  insertTags(articleId, tags)
  return articleId
}

const voteArticle = (id) => {
  const stmt = db.prepare('UPDATE articles SET points = points + 1 WHERE article_id = ?').run(id)
}

/*
 * "Private"
 */


const getArticleTags = (articleId) => {
  const stmt = db.prepare(`SELECT label FROM tags
                           LEFT JOIN tagmap ON tagmap.tag_id = tags.tag_id
                           WHERE tagmap.article_id = ?`)
  return stmt.all(articleId)
}

const getUserName = (id) => {
  const stmt = db.prepare("SELECT name FROM users WHERE submitter_id=?")
  const name = stmt.get(id)
  console.log(name)
  return name.name
}

const insertUser = (id, name) => {
  const stmt = db.prepare("INSERT or ignore INTO users (submitter_id, name) VALUES (?, ?)")
  stmt.run(id, name)
}

const insertTags = (articleId, tags) => {
  const tagStmt = db.prepare('INSERT or ignore INTO tags (label) VALUES (?)')
  const mapStmt = db.prepare('INSERT INTO tagmap (article_id, tag_id) VALUES (?, ?)')
  const idStmt = db.prepare('SELECT tag_id FROM tags WHERE label = ?')
  const insertMany = db.transaction((tags) => {
    for (const tag of tags) {
      tagStmt.run(tag).lastInsertRowid
      const tagId = idStmt.get(tag).tag_id
      mapStmt.run(articleId, tagId)
  }})
  insertMany(tags)
}

function initTable(table, columns) {
  let check = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' and name='${table}'`).get()
  if (check === undefined) {
    console.log("Uninitialized articles table. Creating one.")
    let stmt = db.prepare(`CREATE TABLE IF NOT EXISTS ${table} (${columns})`)
    stmt.run()
    console.log('Created db table \"' + table + '\"')
  }
}

function getValuesOf(dictionaries) {
  let values = []
  for (var i = 0; i < dictionaries.length; i++){
    Object.values(dictionaries[i]).forEach((value) => {
      values.push(value)
    })
  }
  return values
}

const printAll = () => {
  const tables = ["articles", "tagmap", "tags"]
  let results = []
  tables.forEach((table) => {
    let stmt = db.prepare('SELECT * FROM '+ table)
    let result = stmt.all()
    console.log(result)
  })
}


module.exports = { getArticles, insertArticle, voteArticle, getTags}