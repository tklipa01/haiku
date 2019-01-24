var express    = require('express');
var Webtask    = require('webtask-tools');
var Twitter = require('twitter');
var syllable = require('syllable');
var WordPOS = require('wordpos');
var app = express();

app.get('/', function (req, res) {
  if(!req.query.user_name) {
    res.status(400).send("Bad Request. Please provide a user_name");
  }
  var client = new Twitter({
    consumer_key: req.webtaskContext.secrets.TWITTER_CONSUMER_KEY,
    consumer_secret: req.webtaskContext.secrets.TWITTER_CONSUMER_SECRET,
    access_token_key: req.webtaskContext.secrets.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: req.webtaskContext.secrets.TWITTER_ACCESS_TOKEN_SECRET
  });
  client.get(`https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${req.query.user_name}&count=25`, async (err, tweets) => {        
    var tweetTexts = tweets.map(t => t.text)
                           .reduce((acc, cur) => acc + cur, '')
                           .replace(/(?:https?|ftp):\/\/[\n\S]+/g, '') // Remove links
                           .replace(/[.,\/!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation   
                           .split(' ');
    var uniqueWords = tweetTexts.filter((item, pos, self) => self.indexOf(item) === pos); // Remove duplicates    
    var wordpos = new WordPOS();
    var pos = await wordpos.getPOS(uniqueWords.join(' '));
    for(let i in pos) {  
      if(pos.hasOwnProperty(i)){
        pos[i] = pos[i].map(w => ({syllables: syllable(w), word: w, key: i})).filter(w => w.syllables !== 0); // Set each word to have a syllable count and key to which POS it belongs
      }
    }
    var line1 = getLine(5, [...pos.rest], pos);
    var line2 = getLine(7, [...pos.rest], pos);
    var line3 = getLine(5, [...pos.rest], pos);

    var haiku = [line1.map(w => w.word).join(' '),
                 line2.map(w => w.word).join(' '),
                 line3.map(w => w.word).join(' ')];

    res.send(JSON.stringify(haiku));
  });
});

//Produces *slightly* less random text :)
function getLine(syllables, possibleWords, pos) {
  if(syllables <= 0) return [];
  var filteredPossibleWords = possibleWords.filter(w => w.syllables <= syllables);
  if(filteredPossibleWords.length === 0) {
    return [{syllables: 1, word: 'oops', key: 'rest'}]; //Random word meaning we cant completed the haiku correctly
  }
  let index = Math.floor(Math.random() * filteredPossibleWords.length);
  let word = filteredPossibleWords[index]; //Get word at random index
  pos[word.key] = pos[word.key].filter(w => w.word !== word.word); //Remove word from possible words so we dont get duplicates
  return [word, ...getLine(syllables - word.syllables, getPossibleWords(word.key, pos), pos)];
}

function getPossibleWords(position, pos) {
  //Very basic grammar
  if(position === 'nouns') {
    return [...pos.adverbs, ...pos.verbs];
  } else if(position === 'adverbs') {
    return [...pos.adverbs, ...pos.verbs];
  } else if(position === 'verbs') {
    return [...pos.adjectives, ...pos.nouns];
  } else if(position === 'adjectives'){
    return [...pos.adjectives, ...pos.nouns];
  } else if(position === 'rest') {
    return [...pos.nouns];
  }
  console.log('error');
  return [];
}

module.exports = Webtask.fromExpress(app);
