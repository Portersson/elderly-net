const cardDeck = document.getElementById("entries")
const cardTemplate = document.getElementById("template-card").cloneNode(true)
const searchbar = document.getElementById('search')

loadPosts()
searchbar.value = new URLSearchParams(window.location.search).get('tags')
searchbar.addEventListener('input', event => {
  let pageUrl = "?tags=" + encodeURIComponent(searchbar.value)
  window.history.replaceState('','',pageUrl)
  loadPosts()
}, false)

async function loadPosts(){
  let urlParams = new URLSearchParams(window.location.search);
  let response = await fetch('/posts?tags='+urlParams.get('tags'))
  let data = await response.json();
  removeChildren(cardDeck)
  data.forEach((cardInfo) => { 
      buildCard(cardInfo)
  })
}

function buildCard(info){
  var card = cardTemplate.cloneNode(true);
  var image = card.querySelector('.card-image')
  var imageA = card.querySelector('a')
  var imageI = card.querySelector('img')
  var title = card.querySelector('.card-title').querySelector('a')
  var description = card.querySelector('.card-description')
  var meta = card.querySelector('.card-meta')
  var tagContainer = card.querySelector('.tags')
  var date = new Date(parseInt(info.timestamp)).toLocaleDateString()
  console.table(info)
  
  card.id = info.article_id
  imageA.href = info.url
  imageI.src = info.image_url
  title.href = info.url
  title.text = info.title
  description.textContent = info.description
  meta.textContent = date + " by " + info.name +  " (" + info.points + " points)"
  const tags = info.tags
  const range = document.createRange()
  tags.forEach((tag) => {
    const span = range.createContextualFragment("<span class=\"tag is-rounded is-white\">"+ tag.label +"</span>")
    tagContainer.appendChild(span)
  })
  
  cardDeck.appendChild(card)
}

function removeChildren(parent){
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}