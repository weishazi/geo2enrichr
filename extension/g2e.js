
var G2E = (function() {

// This file is built by deploy.sh in the root directory.
var EXTENSION_ID = "ggnfmgkbdnedgillmfoakkajnpeakbel";
var DEBUG = true;
var SERVER = "http://localhost:8083/g2e/";

var Comm = function(events, notifier, SERVER) {

	var fileForDownload = [];

	// We need to make back-to-back AJAX requests to get the relevant data.
	// Querying GEO's esearch endpoint with an accession number returns some JSON with an ID.
	// Then we query GEO's esummary endpoint with the ID.
	// Finally, we fire an event so that any modules that want this data can subscribe.
	var fetchMetadata = function(accession) {
		var EUTILS_BASE = 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
			DB = 'db=gds',
			SETTINGS = '&retmax=1&retmode=json',
			EUTILS_SEARCH = EUTILS_BASE + 'esearch.fcgi?' + DB + SETTINGS,
			EUTILS_SUMMARY = EUTILS_BASE + 'esummary.fcgi?' + DB + SETTINGS;
		$.ajax({
			url: EUTILS_SEARCH + '&term=' + accession + '[ACCN]',
			type: 'GET',
			success: function(search_data) {
				var id = search_data.esearchresult.idlist[0];
				$.ajax({
					url: EUTILS_SUMMARY + '&id=' + id,
					type: 'GET',
					success: function(summaryData) {
						events.fire('metadataFetched', summaryData.result[id]);
					},
					error: errorHandler
				});
			}
		});
	};

	// This is the workhorse function that chains together multiple AJX requests to the back-end.
	var downloadDiffExp = function(userInput) {
		function dlgeo() {
			var endpoint = 'dlgeo?',
				qs = $.param({
					accession: userInput.accession,
					organism: userInput.organism,
					platform: userInput.platform,
					method: userInput.method,
					cell: userInput.cell,
					perturbation: userInput.perturbation,
					gene: userInput.gene
				});

			return $.ajax({
				url: SERVER + endpoint + qs,
				type: 'POST',
				success: function(data) {
				    debugger;
					if (data.status === 'error') {
						errorHandler(data);
						return;
					}
					notifier.log('GEO files were downloaded');
					notifier.log(data);
					events.fire('progressBar');
				}
			});
		}

		function diffexp(dlgeoData) {
			var endpoint = 'diffexp?',
				qs = $.param({
					// This is the SOFT file, not the gene file.
					filename: dlgeoData.filename,
					platform: userInput.platform,
					method: userInput.method,
					control: userInput.control.join('-'),
					experimental: userInput.experimental.join('-')
				});

			return $.ajax({
				url: SERVER + endpoint + qs,
				type: 'POST',
				success: function(data) {
					if (data.status === 'error') {
						errorHandler(data);
						return;
					}
					var DIR = 'static/genes/';
					notifier.log('GEO files were differentially expressed');
					notifier.log(data);
					events.fire('progressBar');
					events.fire('dataDiffExped', {
						'up': SERVER + DIR + data.up,
						'down': SERVER + DIR + data.down
					});
				}
			});
		}

		function enrichr(diffExpData) {
			var endpoint = 'enrichr?',
				qs = $.param({
					'up': diffExpData.up,
					'down': diffExpData.down,
					'combined': diffExpData.combined
				});

			return $.ajax({
				url: SERVER + endpoint + qs,
				type: 'POST',
				success: function(data) {
					if (data.status === 'error') {
						errorHandler(data);
						return;
					}
					notifier.log('Enrichr link was returned');
					notifier.log(data);
					events.fire('progressBar');
					events.fire('genesEnriched', data);
				}
			});
		}

		// Pass in noops so that we do nothing if the promise is not returned.
		dlgeo().then(diffexp, $.noop).then(enrichr, $.noop);
	};

	var fetchGeneList = function() {
		$.ajax({
			url: 'http://amp.pharm.mssm.edu/Enrichr/json/genemap.json',
			type: 'GET',
			dataType: 'JSON',
			success: function(data) {
				events.fire('geneListFetched', data);
			}
		});
	}();

	var fetchRareDiseases = function() {
 		$.ajax({
			url: SERVER + 'diseases',
			type: 'GET',
			dataType: 'JSON',
			success: function(data) {
				events.fire('rareDiseasesFetched', data.rare_diseases);
			}
		});       
	}();

	var errorHandler = function(data) {
		events.fire('requestFailed', data);
	};

	return {
		downloadDiffExp: downloadDiffExp,
		fetchMetadata: fetchMetadata
	};
};


var Events = function() {

	var channel = {};

	var fire = function(eventName, args) {
		if (!channel[eventName]) {
			return false;
		}
		var i = 0,
			len = channel[eventName].length;
		for (; i < len; i++) {
			channel[eventName][i](args);
		}
	};

	var on = function(eventName, callback) {
		if (!channel[eventName]) {
			channel[eventName] = [];
		}
		channel[eventName].push(callback);
	};

	return {
		on: on,
		fire: fire,
	};
};


var Html = function(EXTENSION_ID) {

	var LOGO50X50 = 'chrome-extension://' + EXTENSION_ID + '/images/g2e-logo-50x50.png';

	var modal = '' +
		'<div id="g2e-container">' +
			'<div id="g2e-modal">' +
				'<div id="g2e-title">' +
					'<a href="http://amp.pharm.mssm.edu/Enrichr/" target="_blank">' +
						'<img src="' + LOGO50X50 + '">' +
						'<span>GEO2</span><span class="g2e-highlight">Enrichr</span>' +
					'</a>' +
					'<button id="g2e-close-btn" class="g2e-btn">&#10006</button>' +
				'</div>' +
				'<table id="g2e-main-tbl">' +
					'<tr>' +
						'<td id="g2e-confirm">' +
							'<div class="g2e-lowlight">Please confirm that your data is correct, *required.</div>' +
							'<table class="g2e-confirm-tbl">' +
								'<tr id="g2e-confirm-tbl-diffexp">' +
									'<td class="g2e-tbl-title">' +
										'<label>Differential expression method</label>' +
									'</td>' +
									'<td class="g2e-tbl-value">' +
										'<select>' +
											'<option>Characteristic direction</option>' +
											'<option>T-test</option>' +
										'</select>' +
									'</td>' +
								'</tr>' +
								'<tr id="g2e-confirm-tbl-acc">' +
									'<td class="g2e-tbl-title">Accession num.&#42;</td>' +
									'<td class="g2e-tbl-value g2e-editable"></td>' +
								'</tr>' +
								'<tr id="g2e-confirm-tbl-pltf">' +
									'<td class="g2e-tbl-title">Platform</td>' +
									'<td class="g2e-tbl-value g2e-editable"></td>' +
								'</tr>' +
								'<tr id="g2e-confirm-tbl-org">' +
									'<td class="g2e-tbl-title">Organism</td>' +
									'<td class="g2e-tbl-value g2e-editable"></td>' +
								'</tr>' +
								'<tr id="g2e-confirm-tbl-ctrl">' +
									'<td class="g2e-tbl-title">Control samples&#42;</td>' +
									'<td class="g2e-tbl-value"></td>' +
								'</tr>' +
								'<tr id="g2e-confirm-tbl-expmt" class="g2e-tbl-last">' +
									'<td class="g2e-tbl-title">Treatment or condition samples&#42;</td>' +
									'<td class="g2e-tbl-value"></td>' +
								'</tr>' +
							'</table>' +
							'<div class="g2e-lowlight g2e-bottom">Please fill out these optional annotations, **if relevant.</div>' +
							'<table class="g2e-confirm-tbl">' +
								'<tr id="g2e-confirm-cell">' +
									'<td class="g2e-tbl-title">' +
										'<label>Cell type or tissue</label>' +
									'</td>' +
									'<td class="g2e-tbl-value">' +
										'<input placeholder="No data">' +
									'</td>' +
								'</tr>' +
								'<tr id="g2e-confirm-pert">' +
									'<td class="g2e-tbl-title">' +
										'<label>Perturbation</label>' +
									'</td>' +
									'<td class="g2e-tbl-value">' +
										'<input placeholder="No data">' +
									'</td>' +
								'</tr>' +
								'<tr id="g2e-confirm-gene" class="ui-widget">' +
									'<td class="g2e-tbl-title">' +
										'<label for="geneList">Manipulated gene**</label>' +
									'</td>' +
									'<td class="g2e-tbl-value">' +
										'<input id="geneList" placeholder="No data">' +
									'</td>' +
								'</tr>' +


								'<tr id="g2e-confirm-disease" class="ui-widget g2e-tbl-last">' +
									'<td class="g2e-tbl-title">' +
										'<label for="diseaseList">Rare disease**</label>' +
									'</td>' +
									'<td class="g2e-tbl-value g2e-tbl-last">' +
										'<input id="diseaseList" placeholder="No data">' +
									'</td>' +
								'</tr>' +
							'</table>' +
						'</td>' +
					'</tr>' +
				'</table>' +
				'<div id="g2e-footer">' +
					'<table>' +
						'<tr>' +
							'<td id="g2e-actions" class="g2e-tbl-title">' +
								'<button id="g2e-submit-btn" class="g2e-btn">Extract gene lists</button>' +
							'</td>' +
							'<td id="g2e-progress-bar">' +
								'<div id="g2e-step1" class="g2e-progress">Downloading GEO files</div>' +
								'<div id="g2e-step2" class="g2e-progress">Cleaning data and identifying differential expression</div>' +
								'<div id="g2e-step3" class="g2e-progress">Enriching gene lists with Enrichr</div>' +
								'<div id="g2e-step4" class="g2e-progress">Done!</div>' +
							'</td>' +
						'</tr>' +
						'<tr class="g2e-results">' +
							'<td class="g2e-tbl-title">' +
								'<strong>Enriched genes:</strong>' +
							'</td>' +
							'<td class="g2e-tbl-title">' +
								'<button id="g2e-enrichr-up">Up</button>' +
								'<button id="g2e-enrichr-down">Down</button>' +
								'<button id="g2e-enrichr-combined">All</button>' +
							'</td>' +
						'</tr>' +
						'<tr class="g2e-results">' +
							'<td class="g2e-tbl-title">' +
								'<strong>Downloads:</strong>' +
							'</td>' +
							'<td>' +
								'<button id="g2e-download-btn" class="g2e-btn">Download gene list</button>' +
							'</td>' +
						'</tr>' +
					'</table>' +
                    '<p id="g2e-credits">' + 
                        'GEO2Enrichr is being developed by the <a href="http://icahn.mssm.edu/research/labs/maayan-laboratory" target="_blank">Ma\'ayan Lab</a>.' +
                        ' See the <a href="http://maayanlab.net/g2e/" target="_blank">documentation</a> for details.' +
                    '</p>' +
                '</div>' +
			'</div>' +
		'</div>';

	var templates = {
		'modal': modal,
		'gds': {
			'btn': '' +
				'<tr>' +
					// "azline" comes from the GEO website.
					'<td class="azline" id="g2e-embedded-button">' +
						'<b>Step 4: </b>' +
						'<span id="g2e-link">Pipe into Enrichr</span>' +
						'<img src="' + LOGO50X50 + '">' +
					'</td>' +
				'</tr>'
		},
		'gse': {
			'btn': '' +
				'<tr>' +
					'<td id="g2e-embedded-button">' +
						'<span id="g2e-link">Pipe into Enrichr</span>' +
						'<img src="' + LOGO50X50 + '">' +
					'</td>' +
				'</tr>',
			'thead': '' +
				'<tr valign="top" id="g2e-table-title">' +
					'<td></td>' +
					'<td></td>' +
					'<td class="g2e-ctrl">Ctrl</td>' +
					'<td class="g2e-expmt">Expmt</td>' +
				'</tr>',
			'chkbxs': '' +
				'<td>' +
					'<input class="g2e-chkbx g2e-control" type="checkbox" />' +
				'</td>' +
				'<td>' +
					'<input class="g2e-chkbx g2e-experimental" type="checkbox" />' +
				'</td>'
		}
	};

	return {
		get: function(el, key) {
			if (key) {
				return templates[key][el];
			}
			return templates[el];
		}
	};
};


var Notifier = function(DEBUG) {

	var log = function(msg) {
		if (DEBUG) {
			console.log(msg);
		}
	};

	var ask = function(msg, deflt) {
		return prompt(msg, deflt);
	};

	var warn = function(msg) {
		alert(msg);
	};

	return {
		log: log,
		ask: ask,
		warn: warn
	};
};


var BaseScraper = function(DEBUG, events) {

	var sData = {};

	var genemap;

	return {

		getData: function($modal) {
			// getSamples() returns an object rather than mutating sData
			// because the function must be mixed in at runtime.
			var samples = this.getSamples();
			if ($modal) {
				this.getOptions($modal);
			}

			sData.control      = samples.control;
			sData.experimental = samples.experimental;
			// Short circuit select saved data; this represents user input.
			sData.accession    = sData.accession || this.getAccession();
			sData.organism     = sData.organism || this.getOrganism();
			sData.platform     = sData.platform || this.getPlatform();

			return $.extend({}, sData);
		},

		setData: function(key, val) {
			if (key == 'cell' || key == 'platform') {
				val = val.replace(/_|-|\./g, '');
			}
			sData[key] = val;
		},

		getOptions: function($modal) {
			var method = $modal.find('#g2e-confirm-tbl-diffexp option:selected').val(),
				cell = $modal.find('#g2e-confirm-cell td.g2e-tbl-value input').val(),
				perturbation = $modal.find('#g2e-confirm-pert td.g2e-tbl-value input').val(),
			    gene = $modal.find('#g2e-confirm-gene #genemap').val();

			if (method) {
				sData.method = method;
			}
			if (cell) {
				sData.cell = cell.replace(/_|\.|-/, '');
			}
			if (perturbation) {
				sData.perturbation = perturbation.replace(/_|\.|-/, '');	
			}
			if (gene) {
				sData.gene = gene;
			}
		},

		textFromHtml: function($el) {
			if (!($el instanceof $)) {
				$el = $($el);
			}
			return $el.contents().filter(function() {
				return this.nodeType === 3;
			}).text().trim();
		},

		normalizeText: function(el) {
			return el.replace(/\s/g, '').toLowerCase();
		}
	};	
};


var GdsScraper = function(events) {

	var $details,
		$hook,
		metadata = {};

	events.on('embedded', function(hook) {
		$hook = hook;
	});

	events.on('metadataFetched', function(data) {
		metadata = data;
	});

	events.on('uiReady', function(data) {
		$details = data.details;
	});

	return {

		getAccession: function() {
			return metadata.accession || this.getAccessionFromPage();
		},

		getOrganism: function() {
			return this.getByName('organism');
		},

		getPlatform: function() {
			return this.getByName('platform');
		},

		getSamples: function() {
			var $groupRow = $($hook.children().find('tbody td')[0]),
				bkp_not_found = true,
				samplesStr = this.textFromHtml($groupRow),
				samplesArr = samplesStr.split(' '),
				samplesBkpIdx, control, experimental;

			$.each(samplesArr, function(i, val) {
				if (bkp_not_found && val.substr(val.length-1) !== ',') {
					samplesBkpIdx = i+1;
					bkp_not_found = false;
				} else {
					// WARNING: we're mutating the list while iterating over it. 
					// This should be okay since we're just trimming the comma.
					samplesArr[i] = val.replace(',', '');
				}
			});

			return {
				control: samplesArr.slice(0, samplesBkpIdx),
				experimental: samplesArr.slice(samplesBkpIdx, samplesArr.length)
			};
		},

		getByName: function(name) {
			// 1. Grab the text from the appropriate row
			// 2. Strip out all the whitespace (newlines, tabs, etc.)
			// 3. Split on the semicolon (notice there are two) and return just the code.
			var idx = this.getRowIdxFromName(name);
			var text = $($details.find('tr')[idx]).text();
			// Remove any preceding whitespace.
			return text.split(':')[1].replace(/\s*/, '');
		},

		getRowIdxFromName: function(attrName) {
			var self = this,
				result;
			$details.find('tr').each(function(i, tr) {
				var titleEl = $(tr).find('th')[0],
					titleText = self.normalizeText($(titleEl).text()),
					titleName = titleText.split(':')[0];
				if (titleName === attrName) {
					result = i;
					return false;
				}
			});
			return result;
		},

		getAccessionFromPage: function() {
			var record_caption = $details.find('.caption').text(),
				re = new RegExp(/(?:GDS|GSE)[0-9]*/);
			return re.exec(record_caption)[0];
		}
	};
};


var GseScraper = function(events, html) {

	var key = 'gse',
		$details,
		metadata = {};

	events.on('metadataFetched', function(data) {
		metadata = data;
	});

	events.on('uiReady', function(data) {
		$details = data.details;
	});

	return {

		getByName: function(name) {
			var idx = this.getRowIdxByName(name);
			return $($details.find('tr')[idx]).find('a').text();
		},

		getRowIdxByName: function(attr_name) {
			var self = this,
				result;
			$details.find('tr').each(function(i, tr) {
				var text = $(tr).find('td')
								.first()
								.text();
				text = self.normalizeText(text).replace(/[^a-zA-Z]/g, '');
				if (text === attr_name) {
					result = i;
					return false;
				}
			});
			return result;
		},

		// If required, this can be used as a general purpose query param getter.
		// The accession number is not necessarily in the URL for GDS.
		// Should we check anyway?
		getAccessionFromUrl: function() {
			var params = window.location.search.substring(1).split('&'),
				i = 0,
				len = params.length;
			for (; i < len; i++)  {
				var keyVal = params[i].split('=');
				if (keyVal[0] == 'acc') {
					return keyVal[1];
				}
			}
		},

		getAccession: function() {
			var accession = this.getAccessionFromUrl();
			if (accession) {
				return accession;
			} else if (metadata.accession) {
				return metadata.accession;
			}
		},

		getOrganism: function() {
			if (typeof metadata !== 'undefined' && metadata.taxon) {
				return metadata.taxon;
			}
			return this.getByName('organism');
		},

		getPlatform: function() {
			return this.getByName('platforms');
		},

		getSamples: function() {
			var control = [],
				experimental = [];

			$('.g2e-chkbx').each(function(i, input) {
				var $input = $(input),
					gene;
				if ($input.is(':checked')) {
					gene = $(input).parent()
								   .siblings()
								   .first()
								   .find('a')
								   .text();

					if ($input.hasClass('g2e-control')) {
						control.push(gene);
					} else if ($input.hasClass('g2e-experimental')) {
						experimental.push(gene);
					}
				}
			});

			return {
				control: control,
				experimental: experimental
			};
		}
	};
};


var BaseUi = function(comm, events, html, notifier, scraper) {

	var $downloadIframe = $('<iframe>', { id: 'g2e-dl-iframe' }).hide().appendTo('body');

	var dataConfig = {
		'g2e-confirm-tbl-acc': {
			key: 'accession',
			prompt: 'Please enter an accession number:'
		},
		'g2e-confirm-tbl-pltf': {
			key: 'platform',
			prompt: 'Please enter a platform:'
		},
		'g2e-confirm-tbl-org' : {
			key: 'organism',
			prompt: 'Please enter an organism:'
		},
		'g2e-confirm-tbl-ctrl': {
			key: 'control',
			formatter: function(data) {
				return data.join(', ');
			}
		},
		'g2e-confirm-tbl-expmt': {
			key: 'experimental',
			formatter: function(data) {
				return data.join(', ');
			}
		}
	};
	
	var steps = ['#g2e-step1', '#g2e-step2', '#g2e-step3', '#g2e-step4'];

	var geneList, $overlay, $modal, $progress, $results;

	// This is called once at startup. All variables and bindings should be permanent.
	var init = function() {
		var htmlData = html.get('modal');
		$overlay = $(htmlData).hide().appendTo('body');
		$modal = $('#g2e-container #g2e-modal').draggable();
		$progress = $progress || $('#g2e-progress-bar');
		$results = $results || $('.g2e-results');

		// Allow editing of the values, in case we scraped incorrectly.
		$('.g2e-editable').click(function(evt) {
			var id = $(evt.target).parent().attr('id');
			onEdit(id);
		});

		// Add event handlers
		$modal.find('#g2e-close-btn')
			  .click(resetModalBox)
			  .end()
			  .find('.g2e-confirm-tbl')
			  .eq(1)
			  .end();

		resetSubmitBtn();
	};

	// This function is called every time the "Pipe to Enrichr" button is clicked.
	var openModalBox = function() {
		var scrapedData;
		// Show the user the data we have scraped for confirmation.
		scrapedData = scraper.getData($modal);
		fillConfirmTable(scrapedData);
		showModalBox();
	};

	var highlightNextStep = function() {
		$progress.find(steps.shift()).addClass('g2e-ready');
	};

	// `scraper` also calls this when new data is set.
	// TODO: It shouldn't.
	var fillConfirmTable = function(scrapedData) {
		var elem, config, html;
		for (elem in dataConfig) {
			config = dataConfig[elem];
			if (config.formatter) {
				html = config.formatter(scrapedData[config.key]);
			} else {
				html = scrapedData[config.key];
			}
			$('#' + elem + ' td').eq(1).html(html);
		}
	};

	var setDownloadLinks = function(downloadLinks) {
		$results.find('#g2e-download-btn')
				.click(function() {
					downloadUrl(downloadLinks.up);
					setTimeout(function() {
						downloadUrl(downloadLinks.down);
					}, 1000);
				})
				.end();
	};

	var showResults = function(enrichrLinks) {
		$results.show()	
				.find('#g2e-enrichr-up')
				.click(function() {
					window.open(enrichrLinks.up, '_blank');
				})
				.end()
				.find('#g2e-enrichr-down')
				.click(function() {
					window.open(enrichrLinks.down, '_blank');
				})
				.end()
				.find('#g2e-enrichr-combined')
				.click(function() {
					window.open(enrichrLinks.combined, '_blank');
				});
	};

	var showModalBox = function() {
		$overlay.show();
		$modal.show();
	};

	var hideModalBox = function() {
		$overlay.hide();
		$modal.hide();
	};

	var resetModalBox = function() {
		resetFooter();
		hideModalBox();
	};

	var resetFooter = function() {
		// Reset progress bar.
		steps = ['#g2e-step1', '#g2e-step2', '#g2e-step3', '#g2e-step4'];
		$progress.hide()
				 .find('.g2e-progress')
				 .removeClass('g2e-ready');

		// Result any results.
		$results.hide()
				.find('button')
				.first()
				.unbind();

		resetSubmitBtn();	
	};

	var resetSubmitBtn = function() {
		// Reset submit button.
		$modal.find('#g2e-submit-btn')
			  // This doesn't do anything the first time.
			  .removeClass('g2e-lock')
			  // Remove any event handlers, just to be safe.
			  // This code smells like jQuery spaghetti.
			  .off()
			  .click(function() {
				  var scrapedData = scraper.getData($modal);
				  if (isValidData(scrapedData)) {
					  $progress.show();
					  highlightNextStep();
					  $(this).addClass('g2e-lock').off();
					  comm.downloadDiffExp(scrapedData);
				  } else {
					  resetFooter();
				  }
			  })
			  .end();
	};

	var onEdit = function(id) {
		var config = dataConfig[id],
			userInput = notifier.ask(config.prompt, $('#' + id + ' td').eq(1).text()),
			newData;
		if (userInput !== null) {
			scraper.setData(config.key, userInput);
			newData = scraper.getData();
			if (isValidData(newData)) {
				fillConfirmationTable(newData);
			}
		}
	};

	var fillConfirmationTable = function(scrapedData) {
		var elem, config, html;
		for (elem in dataConfig) {
			config = dataConfig[elem];
			if (config.formatter) {
				html = config.formatter(scrapedData[config.key]);
			} else {
				html = scrapedData[config.key];
			}
			$('#' + elem + ' td').eq(1).html(html);
		}
	};

	var downloadUrl = function(url) {
		$downloadIframe.attr('src', url);
	};

	var isValidData = function(data) {
		if (!data.control || data.control.length < 2) {
			notifier.warn('Please select 2 or more control samples');
			return false;
		}
		if (!data.experimental || data.experimental.length < 2) {
			notifier.warn('Please select 2 or more experimental samples');
			return false;
		}
		// * WARNINGS *
		// It is important to verify that the user has *tried* to select a gene before warning them.
		// $.inArray() returns -1 if the value is not found. Do not check for truthiness.
		if (geneList && data.gene && $.inArray(data.gene, geneList) === -1) {
			notifier.warn('Please input a valid gene.');
			return false;
		}
		return true;
	};

	events.on('requestFailed', function(errorData) {
		notifier.warn(errorData.message);
		resetFooter();
	});

	events.on('geneListFetched', function(geneList) {
		$('#geneList').autocomplete({
			source: function(request, response) {
				var results = $.ui.autocomplete.filter(geneList, request.term);
				response(results.slice(0, 10));
			},
			minLength: 2,
			delay: 250,
			autoFocus: true
		});
	});

	events.on('rareDiseasesFetched', function(diseaseList) {
		$('#diseaseList').autocomplete({
			source: function(request, response) {
				var results = $.ui.autocomplete.filter(diseaseList, request.term);
				response(results.slice(0, 10));
			},
			minLength: 2,
			delay: 250,
			autoFocus: true
		});
	});

	events.on('progressBar', highlightNextStep);
	events.on('dataDiffExped', setDownloadLinks);
	events.on('genesEnriched', showResults);
	
	init();

	return {
		openModalBox: openModalBox
	};
};


var GdsUi = function(html, events) {

	return {

		embed: function($hook) {
			var self = this;
			$hook.children().last().after(html.get('btn', 'gds'));

			events.fire('uiReady', {
				details: $('#gds_details')
			});

			$('#g2e-link').click(function() {
				self.openModalBox();
			});
		},

		init: function() {
			var self = this,
				id;
			id = setInterval(function() {
				var $hook = $('#diff_express > tbody');
				if ($hook.length) {
					events.fire('embedded', $hook);
					self.embed($hook);
					clearInterval(id);
				}
			}, 250);
		}
	};
};


var GseUi = function(html, events) {

	var $gse_details;

	return {

		embed: function($hook) {
			var self = this;
			$hook.append(html.get('btn', 'gse'));

			// Find the details table.
			$('table').each(function(i, el) {
				var $el = $(el);
				if ($el.attr('width') === '600' &&
					$el.attr('cellpadding') === '2' &&
					$el.attr('cellspacing') === '0')
				{
					$gse_details = $el;
					return false;
				}
			});

			if ($gse_details) {
				// Find the samples from the details table.
				$gse_details.find('tr').each(function(i, tr) {
					if ($(tr).find('td')
							 .first()
							 .text()
							 .toLowerCase()
							 .indexOf('samples') === 0)
					{
						$samples_table = $(tr);
						return false;
					}
				});
			}

			if ($samples_table) {
				$samples_table.find('tr').each(function(i, tr) {
					$(tr).append(html.get('chkbxs', 'gse'));
				});

				$samples_table.find('table')
							  .first()
							  .find('tr')
							  .first()
							  .before(html.get('thead', 'gse'));
			}

			events.fire('uiReady', {
				details: $gse_details,
				table: $samples_table
			});

			$('#g2e-link').click(function() {
				self.openModalBox();
			});
		},

		init: function() {
			// Go up two parents to find the table.
			var $hook = $('#geo2r').next();
			if ($hook) {
				this.embed($hook);
			}
		}
	};
};

var main = function() {

	var isGds = function() {
		var path;
		if (window.location.pathname !== '/') {
			path = window.location.pathname.split('/')[1];
			if (path === 'sites') {
				return true;
			} else if (path === 'geo') {
				return false;
			}
		}
	};

	var init = function() {
		// EXTENSION_ID, DEBUG, and SERVER are set in config.js via deploy.sh.
	    var events = Events(),
			notifier = Notifier(DEBUG),
			html = Html(EXTENSION_ID),
			baseScraper = BaseScraper(DEBUG, events),
			scraper,
			ui,
			comm;

		if (isGds()) {
			modeScraper = GdsScraper(events);
			scraper = $.extend(modeScraper, baseScraper);
			comm = Comm(events, notifier, SERVER);
			ui = $.extend(GdsUi(html, events), BaseUi(comm, events, html, notifier, scraper));
		} else {
			modeScraper = GseScraper(events, html);
			scraper = $.extend(modeScraper, baseScraper);
			comm = Comm(events, notifier, SERVER);
			ui = $.extend(GseUi(html, events), BaseUi(comm, events, html, notifier, scraper));
		}

		// This executes in the background, collecting information about the page before the user even inputs.
		if (scraper.getAccessionFromUrl) {
			comm.fetchMetadata(scraper.getAccessionFromUrl());
		}

		ui.init();
		notifier.log('g2e loaded.');
	};

	init();
};


	window.onload = main();

})(jQuery);
