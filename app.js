// library imports
const _ = require('lodash');
const Request = require('request-promise-native');

const LIST_OF_WORDS_URL = process.env.list_of_words_url || 'https://raw.githubusercontent.com/despo/hangman/master/words';
const GAME_URI = process.env.game_uri || 'http://hangman-api.herokuapp.com';
const MAX_WRONG_ATTEMPTS = 7;
let WORDS = null;
let charactersUsed = [];

const initialize = async () => {
	try {
		WORDS = await Request({
			method: 'GET',
			uri: LIST_OF_WORDS_URL
		});

	} catch (error) {
		console.log('Error: ', error.message ? error.message : error);
		process.exit(0);
	}

	startGame();
};

const frequencyCounter = (str) => {
	let obj = str.split('').reduce((total, letter) => {
		letter = letter.toLowerCase();
		if (charactersUsed.includes(letter)) {
			return total;
		}
		if (!total[letter]) {
			total[letter] = {
				letter,
				count: 1
			};
		} else {
			total[letter].count++
		}
		return total;
	}, {});
	return Object.values(obj);
};

const startGame = async () => {
	let token = null;
	let hangmanWord = null;
	let wrongAttempts = 0;
	let wrongCharacters = [];

	// POST call to /hangman to start the game
	try {
		let res = await Request({
			method: 'POST',
			uri: GAME_URI + '/hangman'
		});
		res = JSON.parse(res);
		token = res.token;
		hangmanWord = res.hangman;
	} catch (error) {
		console.log('Error: ', error.message ? error.message : error);
		process.exit(0);
	}

	console.log('GAME STARTED');
	console.log('Hangman Word:', hangmanWord);

	let turnNumber = 1;
	while (wrongAttempts < MAX_WRONG_ATTEMPTS && hangmanWord.includes('_')) {
		// Filter out words of the length of hangmanWord
		let regex = hangmanWord.replace(/\_/g, '.');
		let words = WORDS.match(new RegExp(`^${regex}$`, 'gmi'));
		if (wrongCharacters.length) {
			let wrongCharactersRegex = new RegExp(wrongCharacters.join('|'), 'i');
			words = words.filter(word => {
				if (wrongCharactersRegex.test(word)) {
					return false;
				}
				return true;
			});
		}
		if (!words) {
			return;
		}
		if (words.length === 1) {
			words = [words[0]];
		}

		// Find most frequent of characters in filtered words
		let frequencies = frequencyCounter(words.join(''));
		frequencies = _.orderBy(frequencies, ['count'], ['desc']);
		let mostFrequentCharacter = frequencies[0].letter;

		console.log(`Turn Number ${turnNumber}: Guessing letter: ${mostFrequentCharacter.toUpperCase()}`);

		// PUT call to /hangman with the most frequent character
		try {
			let res = await Request({
				method: 'PUT',
				uri: GAME_URI + '/hangman',
				formData: {
					token,
					letter: mostFrequentCharacter
				},
				headers: {
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
				}
			});
			charactersUsed.push(mostFrequentCharacter);
			res = JSON.parse(res);
			token = res.token;
			hangmanWord = res.hangman;

			if (!res.correct) {
				console.log(`Turn Number ${turnNumber}: Guessed wrong!`);
				console.log(`Turn Number ${turnNumber}: Hangman Word: ${hangmanWord}`);
				wrongAttempts = wrongAttempts + 1;
				wrongCharacters.push(mostFrequentCharacter);
			} else {
				console.log(`Turn Number ${turnNumber}: Guessed correctly!`);
				console.log(`Turn Number ${turnNumber}: Hangman Word: ${hangmanWord}`);
			}

			console.log(`Turn Number ${turnNumber}: Characters Guessed: ${charactersUsed.map(char => char.toUpperCase()).join(', ')}`);
			console.log(`Turn Number ${turnNumber}: Wrong Characters Guessed: ${wrongCharacters.map(char => char.toUpperCase()).join(', ')}`);
			console.log(`Turn Number ${turnNumber}: Wrong Attempts: ${wrongAttempts}`);
		} catch (error) {
			console.log('Error: ', error.message ? error.message : error);
			process.exit(0);
		}

		turnNumber = turnNumber + 1;
		console.log('-----------------------')
	}

	if (wrongAttempts == MAX_WRONG_ATTEMPTS) {
		console.log('GAME LOST!');
	} else {
		console.log('GAME WON!');
	}
};

initialize();