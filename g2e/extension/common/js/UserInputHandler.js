
function UserInputHandler(comm, events, notifier, screenScraper, tagger) {

    var geneList;
    events.on('geneListFetched', function(data) {
        geneList = data;
    });

    var $modalBox;
    function setModalBox($el) {
        $modalBox = $el;
    }

    function sendDataToServer() {
        var selectedData = getData();
        if (isValidData(selectedData)) {
            selectedData = prepareForTransfer(selectedData);
            comm.postSoftFile(selectedData);
            events.fire('dataPosted');
        }
    }

    function prepareForTransfer(selectedData) {
        var result = {};

        $.each(selectedData.scrapedData, function(key, obj) {
            result[key] = obj;
        });

        $.each(selectedData.userOptions, function(key, obj) {
            result[key] = obj;
        });

        result.metadata = {};
        $.each(selectedData.crowdsourcedMetadata, function(key, obj) {
            result.metadata[key] = obj;
        });

        result.tags = selectedData.tags;

        return result;
    }

    function getData() {
        return {
            scrapedData: screenScraper.getDataFromPage(),
            userOptions: getUserOptions(),
            tags: tagger.getSelectedTags(),
            crowdsourcedMetadata: getCrowdsourcedMetadata()
        };
    }

    function isValidData(data) {
        var selectedTags = tagger.getSelectedTags(),
            tag,
            field,
            conf,
            selectedValue;

        if (!data.scrapedData.A_cols || data.scrapedData.A_cols.length < 2) {
            notifier.warn('Please select 2 or more control samples');
            return false;
        }
        if (!data.scrapedData.B_cols || data.scrapedData.B_cols.length < 2) {
            notifier.warn('Please select 2 or more experimental samples');
            return false;
        }
        // It is important to verify that the user has *tried* to select a gene before warning them.
        // $.inArray() returns -1 if the value is not found. Do not check for truthiness.
        if (geneList && data.userOptions.gene && $.inArray(data.userOptions.gene, geneList) === -1) {
            notifier.warn('Please input a valid gene.');
            return false;
        }

        // Use traditional for loops so we can exit early if necessary.
        for (tag in selectedTags) {
            for (field in selectedTags[tag]) {
                conf = selectedTags[tag][field];
                selectedValue = data.crowdsourcedMetadata[field];
                if (conf.required && !selectedValue) {
                    notifier.warn('Please add metadata field "' + conf.description + '"');
                    return false;
                }
            }
        }

        return true;
    }

    function getUserOptions() {

        var data = {},
            method = $modalBox.find('#g2e-diffexp option:selected').val(),
            cutoff = $modalBox.find('#g2e-cutoff option:selected').val(),
            normalize = $modalBox.find('#g2e-normalize option:selected').val(),
            cell = $modalBox.find('#g2e-cell .g2e-value input').val(),
            perturbation = $modalBox.find('#g2e-perturbation .g2e-value input').val(),
            gene = $modalBox.find('#g2e-gene #g2e-geneList').val(),
            disease = $modalBox.find('#g2e-disease #g2e-diseaseList').val(),
            threshold = $modalBox.find('#g2e-threshold option:selected').val();

        if (method) {
            data.diffexp_method = method;
        }
        if (cutoff) {
            data.cutoff = cutoff;
        }
        if (normalize) {
            data.normalize = normalize;
        }
        if (cell) {
            data.cell = cell.replace(/_|\.|-/, '');
        }
        if (perturbation) {
            data.perturbation = perturbation.replace(/_|\.|-/, '');
        }
        if (gene) {
            data.gene = gene;
        }
        if (disease) {
            data.disease = disease;
        }
        if (threshold) {
            data.threshold = threshold;
        }

        return data;
    }

    /* August 2015:
     * Gets data from fields that are specific for the upcoming Coursera
     * MOOC. In principle, we can remove this in the future.
     */
    function getCrowdsourcedMetadata() {
        // I really hate how much this function knows about the DOM.
        var result = {};
        var $table = $modalBox.find('#g2e-required-fields-based-on-tag');
        $.each(tagger.getNewFields(), function(i, key) {
            var $input = $table.find('#' + key + ' input');
            if ($input.length) {
                result[key] = $input.val().replace(/ /g,'');
            }
        });
        return result;
    }

    return {
        getData: getData,
        sendDataToServer: sendDataToServer,
        setModalBox: setModalBox
    };
}