// Created with Squiffy 5.1.0
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                /*if (!result[1]) {
                                    disableLink(link);
                                }*/
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }

    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };

    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;

            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;

                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);

                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }

            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }

            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));

                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();

            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'Beginning';
squiffy.story.id = '058bb12976';
squiffy.story.sections = {
  'Beginning': {
		'text': "<p>In your world, there is something that everyone believes in. omething unimaginable to those a century ago. That &#39;something&#39; reconstructed the way you think about life,death, and reality. ut to the people today, that &#39;something&#39; has become so integrated in their lives that it is common sense, like &#39;social media&#39; in the Digital Age. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">And yet...</a></p>",
		'attributes': ["variable=0"],
		'passages': {
		},
	},
	'_continue1': {
		'text': "<iframe width=\"100%\" height=\"70\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/218824037&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>\n\n<p>And yet, somewhere in your dramatic internal monologue, you begin to wonder if any of this is true. If you’re even real, and what even is &#39;real&#39;. That was why you decided to become a <a class=\"squiffy-link link-passage\" data-passage=\"programmer\" role=\"link\" tabindex=\"0\">programmer</a>, to understand <a class=\"squiffy-link link-passage\" data-passage=\"the Connection\" role=\"link\" tabindex=\"0\">the Connection</a>. To understand <a class=\"squiffy-link link-passage\" data-passage=\"the Spirits\" role=\"link\" tabindex=\"0\">the Spirits</a>. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'programmer': {
				'text': "<p>You always thought programmers were the creators of the world, or at least, of the society that exists today. The curiosity inside you made you want to understand your world a little bit better, and even as you grow up, curiosity remained a curiosity. There were no big aspirations or ambitions, the little curiosity in you was all the drive you had when you pursued programming in school. You hope that once you begin to work for the government , you’ll begin to know what you want to do too. </p>",
			},
			'the Connection': {
				'text': "<p>In your world today, &#39;the Connection&#39;(yes, with a capital C) is the conduit the physical world with the Spiritual Realm. It allows you to communicate with the dead, particularly your loved ones, who return through the Connection as entities known as <a class=\"squiffy-link link-passage\" data-passage=\"the Spirits\" role=\"link\" tabindex=\"0\">the Spirits</a>. </p>",
			},
			'the Spirits': {
				'text': "<p>The spirits are what people become once they perish. They lack a corporeal form and cannot be interacted with without the Connection.</p>",
			},
		},
	},
	'_continue2': {
		'text': "<p>Just when you finally got a job to work at the controlling all this technology, <a class=\"squiffy-link link-passage\" data-passage=\"the Plague\" role=\"link\" tabindex=\"0\">the Plague</a> hit. </p>\n<p>As you stare at the face of the love of your life, lying lifelessly on the hospital bed, you find yourself wondering once again if everything that happened was real.</p>\n<p>&quot;I&#39;m terribly sorry for your loss, Akihiro.&quot; <a class=\"squiffy-link link-passage\" data-passage=\"Dr.Lee\" role=\"link\" tabindex=\"0\">Dr.Lee</a> says to you, putting a hand on your shoulder. </p>\n<p>&quot;This can’t be real,&quot; you blurt out, eyes still fixated on the person--<a class=\"squiffy-link link-passage\" data-passage=\"the body\" role=\"link\" tabindex=\"0\">the body</a> of the person that you love. You begin to tremble, but somehow your voice remained even. &quot;Please tell me it isn’t.&quot;</p>\n<p>&quot;Akihiro, you see people like this everywhere in the hospital..&quot; Dr.Lee&#39;s voice is soft and comforting. &quot;I&#39;m afraid there is nothing else I can do.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'the Plague': {
				'text': "<p>A nation wide epidemic, reported to have killed roughly 1/3 of the population, mostly young adults. You’ve seen cases of its victims, but no one knew the cause. </p>",
			},
			'Dr.Lee': {
				'text': "<p>Dr.Lee is a nice person. You see them around in the hospital, bustling about, talking to patients and giving instructions to nurses. Doctors like them are hard to come by these days. Their dark circles get worse each time you see them.</p>",
			},
			'the body': {
				'text': "<p>Their hand is still warm, your fingers are still intertwined with theirs, but you can feel the warmth slipping away as time passes. You know you should leave, you are still reluctant to let go. </p>",
			},
		},
	},
	'_continue3': {
		'text': "<p>You know Dr. Lee is telling the truth. You know you’re looking for a cheap attempt to escape reality, but you can’t admit to yourself that <i>they</i>, out of all people, is dead, right?.</p>\n<p>&quot;I&#39;ll give you some time.&quot; Dr.Lee backs out of the room. You press your lover’s hand to your forehead and let out a shaky breath. You can hear cries of despair outside the room and you it rather morbid that you find their cries comforting. At least you are not the only one who is suffering.</p>\n<p>You notice shuffling noises from the hospital bed next to you and turn to see <a class=\"squiffy-link link-passage\" data-passage=\"a child\" role=\"link\" tabindex=\"0\">a child</a> staring you with wide eyes. &quot;Why are you sad that they are dead?&quot; they ask.</p>\n<p>&quot;You know that we can still see them as Spirits, right?&quot; They tilt their head in confusion. &quot;My momma says that all the time.&quot;</p>\n<p>How do you respond?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"alive\" role=\"link\" tabindex=\"0\">&quot;There is something special to being alive.&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"spirits\" role=\"link\" tabindex=\"0\">&quot;It&#39;s lonely when they are no longer the same as you.&quot;</a></p>",
		'passages': {
			'a child': {
				'text': "<p>You do not know the child&#39;s name. This is the first time you’ve heard them speak. Every time you came to visit, the child was asleep. You’ve never seen their parents, but sometimes you would peel fruits and leave some on their bedside table. You heard from your significant other that they were quite sweet.</p>",
			},
		},
	},
	'alive': {
		'text': "<p>&quot;There is something special to being alive.&quot; </p>\n<p>The child looks puzzled by your words, so you continue.\n&quot;There is a lot more things that you can&#39;t feel anymore after you are dead.&quot;\nYou stroke your beloved’s cheek gently. It’s so cold. You’ve never seen them so pale before. </p>\n<p>&quot;That&#39;s not really what my momma says.&quot; The child plays with their long hair, putting it in their mouth to chew. Your lover told you they also used to do that when they were young. &quot;Momma is always like &quot;being a Spirit is the best! You don&#39;t eat because you have to, you eat because you <b>want</b> to!&quot;&quot; They make a fist in front of their mouth and makes a motion that looks as if they are scraping food off of a plate. </p>\n<p>You take a moment to reflect on the child&#39;s words, and you do not know how to respond.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=1"],
		'passages': {
		},
	},
	'spirits': {
		'text': "<p>&quot;I know that, but...&quot; You purse your lips, trying to gather yourself. &quot;When they are Spirits, they’re different from us.</p>\n<p>They’re not people anymore. Even with the Connection, I don&#39;t know if they can still understand me.&quot;</p>\n<p>&quot;They don&#39;t seem any different to me.&quot; The child chirps happily. &quot;Momma still sounds the same as a Spirit.&quot; They stare into the air, as if to reminiscing something. &quot;I sometimes get to go home and see Momma. They said that I can soon be with them in the land of the Spirits, and that it&#39;s not really different from being alive.&quot; </p>\n<p>You smile at the child&#39;s words, and feel somewhat comforted.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=1"],
		'passages': {
		},
	},
	'transition': {
		'text': "<p>Despite their childlike speech, you’re reminded of your lover’s parents. {if seen alive:You never know how to talk to those people, and neither does your other half.}{else:You have always felt close to them, like family, but your other half always seems to think otherwise.} They constantly lectured you on the benefits of being a spirit. Maybe it is why they chose euthanasia when the sickness went too far. You wonder if they got to reunite with their child, now that the Plague hit.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"child2\" role=\"link\" tabindex=\"0\">The child</a> hops off the bed and approaches you. They peer over your shoulder at your lover. &quot;They look like they’re sleeping.&quot; They squeezed your hand comfortingly. &quot;They told me that you are the nice person that always leave me fruits, so I&#39;ll tell you a secret.&quot;</p>\n<p>The child skips back to their bed, and tugs on white curtains, revealing a <a class=\"squiffy-link link-passage\" data-passage=\"window\" role=\"link\" tabindex=\"0\">window</a>.</p>\n<p>&quot;Do you see that?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'child2': {
				'text': "<p>Without their blanket, you notice the child is only wearing <a class=\"squiffy-link link-passage\" data-passage=\"a loose tanktop\" role=\"link\" tabindex=\"0\">a loose tanktop</a> and <a class=\"squiffy-link link-passage\" data-passage=\"gym shorts\" role=\"link\" tabindex=\"0\">gym shorts</a>. It’s winter, and even though the temperature is being monitored and adjusted here, you cannot help but wonder if the child is cold. </p>\n<p>In the back of your mind, you recall that victims of the Plague are allowed to wear their own clothes.</p>",
			},
			'a loose tanktop': {
				'text': "<p>The tanktop has a large print in the center, which portrays a weird amalgam of different animals. It is mildly unsettling to look at. </p>",
			},
			'gym shorts': {
				'text': "<p>The gym shorts hang loose on the child, a painful indication on how scrawny they are. The elastic sticks out of the waist, and is tied into a tight knot to prevent the pants from falling.</p>",
			},
			'window': {
				'text': "<p>The solitary window in the room was right by the kid’s bed, and since they were always sleeping, you never got the chance to see the scenery behind the curtains. </p>",
			},
		},
	},
	'_continue4': {
		'text': "<p>The child opens the window and points at {label:2=<a class=\"squiffy-link link-passage\" data-passage=\"a skyscraper\" role=\"link\" tabindex=\"0\">a skyscraper</a>} in the distance. You instantly recognize that the room is facing the Downtown area.</p>\n<p>&quot;That is the God Tower!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"G.D.O Tower\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'a skyscraper': {
				'text': "<p>The skyscraper is one of the most distinct landmarks because it is the control center of technology in this city. It’s design is that of a spiralling double helix, and has a constant faint glow though more visible at night.</p>\n<p>It is known as the <a class=\"squiffy-link link-section\" data-section=\"G.D.O Tower\" role=\"link\" tabindex=\"0\">G.D.O Tower</a>. </p>",
			},
		},
	},
	'G.D.O Tower': {
		'text': "<p>Government Data Output Tower, hence G.D.O. Since everyone finds pronouncing each individual letter troublesome, G.D.O is more often called the God Tower nowadays. It is the headquarter of the department that handles the Connection between the Spirit Realm and our world, running 24/7 to ensure that everyone can see their loved ones whenever. It has only malfunctioned once since it started running as you recall from your high school history lessons.</p>\n<p>It will once again become your workplace after your break is over. </p>\n<p>You have always thought of their technology as:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Impressive\" role=\"link\" tabindex=\"0\">Impressive</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Sketchy\" role=\"link\" tabindex=\"0\">Sketchy</a></p>",
		'attributes': ["@replace 2=<p>G.D.O Tower</p>"],
		'passages': {
		},
	},
	'Impressive': {
		'text': "<p>Impressive</p>\n<p>The Realm of the Dead had always been unreachable to man.  It’s quite impressive that science and technology are explaining the more mystical side of the world. You, as well as everyone else, are appreciative of these advancements.</p>\n<p>Snapping yourself out of your thought, you look at the child. While you know what the G.D.O Tower is, the chipper expression on their face makes you want to <a class=\"squiffy-link link-section\" data-section=\"humor them a bit\" role=\"link\" tabindex=\"0\">humor them a bit</a>.</p>",
		'attributes': ["variable+=1"],
		'passages': {
		},
	},
	'Sketchy': {
		'text': "<p>Sketchy</p>\n<p>You always felt the government has been withholding some information regarding the technology of the Connection. You have always been somewhat of a dreamer, who believed in the more mystical side of life that should not and cannot explained by science. As much as you are fascinated by technology, and acknowledge that technology is certainly helping reunite families after death, you wonder if this kind of technology really <b>should</b> exist.</p>\n<p>You look at the child. While you know what the G.D.O Tower is, the chipper expression on their face makes you want to <a class=\"squiffy-link link-section\" data-section=\"humor them a bit\" role=\"link\" tabindex=\"0\">humor them a bit</a>.</p>",
		'attributes': ["variable-=1"],
		'passages': {
		},
	},
	'humor them a bit': {
		'text': "<p>You’re surprised you’re able to talk so patiently with a child even when you’re weighed down by your lover’s death. This must be what emotional numbness is. &quot;God Tower?&quot; You try to look as quizzical as you can.</p>\n<p>The child rolls their eyes at you. &quot;I wasn&#39;t try to tell you what it is. Come on, everyone knows what it is.&quot; You begin to wonder if you were too condescending watching them turn their head to the Tower and press their palms flat to the glass. Their dark skin glistens under the winter sun. </p>\n<p>&quot;This is a secret but...&quot; Their voice falls to a whisper at the word &quot;secret&quot;. You move close beside them to hear what they are saying. <h5>&quot;Momma once told me that they live in the Tower.&quot;</h5> Their voice falls even lower. </p>\n<h5>&quot;As a Spirit.&quot;</h5>\n\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<p>Their words throw you off. &quot;The Spirits live in the Spirit Realm,&quot; you say. &quot;There is no particular place they live.&quot;</p>\n<p>&quot;Mm..&quot; The child furrows their brows. It looks like a giant fuzzy caterpillar lying across their forehead and you stifle a laugh. &quot;I didn&#39;t really get it either.&quot; They keep their eyes on the tower, looking wistful. &quot;Momma said the Tower is special. It&#39;s where the Spirits are. No one else would believe her, but I do.&quot; They let their arms flop to their side, eyes still on the Tower. &quot;Do you believe me?&quot;</p>\n<p>&quot;...I do.&quot; You say quietly, putting a hand on their head. It would be cruel to state otherwise. It could make sense. Since the Connection is established at the Tower, it would be fair for Spirits to think that the Tower is their home. Given that you do not know the child&#39;s mother and whether they have a grasp of modern technology, you decide to let it go.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue6': {
		'text': "<p>The child has been silent for a while now. They’re starting to shiver so you urge them away from the window and draw the heavy curtains close again. The child obeys quietly and climbs back into bed.</p>\n<p>&quot;I&#39;m sleepy again.&quot; They rub their eyes. &quot;Are you not going to come here again? Now that...you know&quot; They nod at the bed your lover’s body lies upon. You appreciate their tact. </p>\n<p>Although you&#39;d rather not come to this hospital room again, you shake your head. &quot;I’ll come again.&quot; You pause. &quot;With more fruit.&quot; You add.</p>\n<p>&quot;Promise?&quot;</p>\n<p>&quot;Promise.&quot;</p>\n<p>The child drifts into the land of dreams. You hope that they are with their momma in that dream.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue7': {
		'text': "<iframe width=\"100%\" height=\"75\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/216763006&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>\n\n<p>With the room once again silent, you feel helplessness creeping in.</p>\n<p>Knowingly or unknowingly, the child was distracting you from reality. The room seems to close in on you, suffocating you. You cough, and decide that maybe it&#39;s time to head out. </p>\n<p>Dr.Lee is still not back yet. You think of what you need to do now,  like getting the Death Certificate. The thought hurts.</p>\n<p>You kiss your lover’s forehead, staring at their face. Once you leave, nurses will carry the body out and prepare for incineration. You etch their face into your mind. You’ll see them again soon, as a Spirit, but this moment with them, where you can still feel their physical presence, is still different.</p>\n<p>{sequence:.:..:...:....:.....:<a class=\"squiffy-link link-section\" data-section=\"Ready\" role=\"link\" tabindex=\"0\">You finally manage to tear your eyes off of them.</a>}</p>",
		'passages': {
		},
	},
	'Ready': {
		'text': "<p>You leave a note for Dr.Lee to call you. After taking a deep breath, you force your legs to move out the door.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue8': {
		'text': "<p>The air is crisp and cold as you step out into <a class=\"squiffy-link link-passage\" data-passage=\"the streets\" role=\"link\" tabindex=\"0\">the streets</a>. Your body feels strange and empty, , you feel like everything that just happened in the hospital was a dream.</p>\n<p>You head absently  towards central Downtown where your small <a class=\"squiffy-link link-passage\" data-passage=\"apartment\" role=\"link\" tabindex=\"0\">apartment</a> is, but pause when it occurs that you could go elsewhere. </p>\n<p>You check the map on your phone, which marks spots you frequently visit. The map marks out <a class=\"squiffy-link link-passage\" data-passage=\"Natt's house\" role=\"link\" tabindex=\"0\">Natt&#39;s house</a>, <a class=\"squiffy-link link-passage\" data-passage=\"CyBeer\" role=\"link\" tabindex=\"0\">CyBeer</a>, and <a class=\"squiffy-link link-passage\" data-passage=\"Home\" role=\"link\" tabindex=\"0\">Home</a>.</p>\n<p>You turn on the navigation to:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Natt's house\" role=\"link\" tabindex=\"0\">Natt&#39;s house</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"CyBeer\" role=\"link\" tabindex=\"0\">CyBeer</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Home\" role=\"link\" tabindex=\"0\">Home</a></p>",
		'passages': {
			'the streets': {
				'text': "<p>The streets in Downtown are always busy around lunchtime. You see people in suits speed walking through the crowds to grab a quick bite before they can get back to work again. The sound of car horns and the smell of greasy street food makes you feel more grounded, somehow. </p>",
			},
			'apartment': {
				'text': "<p>You only moved to this apartment recently, hoping to be closer to your job in the G.D.O Tower. The apartment is cramped but cozy, and above all, the view facing the office buildings is fantastic and your heart leaps with joy every time you see it. Some may find it loud and dirty during the day, but you enjoy the quiet, neon glow that the buildings emit at night when everything seems more alive. The glowing scenery is strangely serene at around midnight, when no one wants to be near where they work.</p>",
			},
			'Home': {
				'text': "<p>Perhaps you should just go home. The Connection takes a while to locate the correct Spirit at times, but perhaps you’ll be able to see your other half again as a hologram in the room, trying to make you something. Even if the Connection is not established yet, there are always your parents that are waiting for your arrival through the Connection.</p>",
			},
			'Natt\'s house': {
				'text': "<p>Natt’s been your best friend since childhood. You had a fallout with them in your teenage years when other’s kept mistaking you for a couple, but you made up quickly after realizing how stupid it was to let other people&#39;s decisions influence you. Natt is always the type that holds themselves straight, and without their positivity you aren’t sure you would have made it this far. They’ve been worried about you ever since your significant other was infected by the Plague, and you can always use the comfort of your friends. Perhaps you should pay a visit?</p>",
			},
			'CyBeer': {
				'text': "<p>Despite the terrible pun, CyBeerSpace is a quaint little beer pub tucked in a corner of a sketchy-looking alleyway. Stereotypes dictate that those are always the best places for local food, and CyBeerSpace perpetuates that cliché.  Your favourite combo is the chicken club sandwich with a bottle of lager, accompanied by the whimsical chitchats with the bartender Anival. It would make sense to pay a visit there for lunch, plus, pounding down a beer may help calm your spirits a bit.</p>",
			},
		},
	},
	'Natt\'s house': {
		'text': "<p>Natt&#39;s house</p>\n<p>After thinking for a second, you head for Natt’s house. It’s not too far from your location, and you remember how excited they were when you said you were moving to Downtown. You realize that you haven’t visited them since you moved in. You try not to think about the reason behind that.</p>\n<p>You reach the <a class=\"squiffy-link link-passage\" data-passage=\"rectangular building\" role=\"link\" tabindex=\"0\">rectangular building</a> with its big, double glass doors. A scanning device extends out of the wall near the entrance. You stand in front of the eye in the center of the triangle device and let its infrared ray run across your body, and after a short buzzing noise, the small holes opened up on the metal, triangular surface surround the eye. </p>\n<p>No matter how many times you look at it, this thing always gives you goose bumps.</p>\n<p>&quot;Aki?&quot; A familiar voice calls out to you through the intercom.</p>\n<p>&quot;Hey.&quot; </p>\n<p>There was a moment of silence before you see the glass door slowly opening in front of you. &quot;Come in.&quot;</p>\n<p>As usual, you head for the <a class=\"squiffy-link link-passage\" data-passage=\"staircase\" role=\"link\" tabindex=\"0\">staircase</a>, not wanting to wait for the elevator when it’s only one floor up. </p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Natt\" role=\"link\" tabindex=\"0\">Natt</a> is already waiting at the door when you reach the corridor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'rectangular building': {
				'text': "<p>Natt is one of the most well-off people you know. When you were still young you used to get intimidated by their parent&#39;s mansion. There were guards and surveillance cameras, and even  guard dogs. Compared to before, the level of protection has significantly mellowed now that they moved out and formed their own, much less paranoid, family. </p>",
			},
			'staircase': {
				'text': "<p>For a luxury apartment, the staircase is rather dusty and old-fashioned. The harsh, defined outline of the building and this corkscrew staircase do not match. </p>",
			},
			'Natt': {
				'text': "<p>You have never forgotten Natt&#39;s fiery red hair. You loved it when they had long hair, cascading down their back, smooth and shiny against their tanned skin. Ever since they got married, their hair was kept short. Their spouse seemed to enjoy seeing their muscles that would be hidden by long hair.</p>",
			},
		},
	},
	'_continue9': {
		'text': "<p>Natt makes a &quot;come in&quot; gesture with their chin, and, without a word, you take off your shoes in front of the door and step inside.</p>\n<p>In an instant, you hear a loud bark from one of the rooms in the apartment, and you see {label:3=<a class=\"squiffy-link link-passage\" data-passage=\"a dog spirit\" role=\"link\" tabindex=\"0\">a dog spirit</a>} running towards you.</p>\n<p>&quot;Rugby, stay!&quot; Rugby halts instantly at Natt&#39;s order, but wriggles excitedly  and licks his chops. &quot;Sorry about that, Aki.&quot; Natt apologizes and presses their credit card on a card reader. After a beep, Rugby disappears. &quot;I wasn&#39;t expecting company today.&quot;</p>\n<p>&quot;It&#39;s fine.&quot; You take a seat on the couch. &quot;I haven&#39;t seen him in a long time, anyway.&quot;</p>\n<p>Natt lets out a dry laughs and sits beside you. They are silent again, and seem to be very keen on observing their knee. Watching their mouth open and close at multiple attempts of conversation, you know that they are struggling with what to say. &quot;Being careful with your words is good, Natt.&quot; You try to help break the ice a bit. &quot;But careful not to hurt yourself.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'a dog spirit': {
				'text': "<p>A Dalmatian, he had been with Natt ever since they were little. He spent 15 years with Natt before dying of old age, and you remember how much Natt was crying during his funeral. Rugby is the main reason that they installed <a class=\"squiffy-link link-passage\" data-passage=\"360 Projection\" role=\"link\" tabindex=\"0\">360 Projection</a> in his new home, so that even after death, Rugby can remained by Natt&#39;s side. Natt would never admit it though. </p>",
				'attributes': ["@replace 3=<p>Rugby</p>"],
			},
			'360 Projection': {
				'text': "<p>Much more expensive than the regular Projection Rooms available in regular apartments. They allow 360 access to Spirits, projecting their presence through the entire house. </p>",
			},
		},
	},
	'_continue10': {
		'text': "<p>Natt takes a deep breath and looks into your eyes with such genuine concern that you begin to feel bad for not contacting them for so long. Your jaw works, forcing out the words. &quot;They passed away yesterday.&quot; You try not to think too much of it.</p>\n<p>You hear Natt sigh, because everyone, including you, had seen it coming. They dart their eyes at the 360 Projection ball on top of the ceiling, and then back to you. &quot;I&#39;m sorry about your lover, Aki.&quot; Natt says in a quiet voice. </p>\n<p>How do you respond?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"sympathy\" role=\"link\" tabindex=\"0\">&quot;They are not the only victim to the Plague.&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"attachment\" role=\"link\" tabindex=\"0\">&quot;At least I can still see them as a Spirit.&quot;</a></p>",
		'passages': {
		},
	},
	'sympathy': {
		'text': "<p>&quot;They are not the only victim to the Plague.&quot;</p>\n<p>You reply. &quot;Many others died. I’m not the only one who suffered. I shouldn’t sit around feeling sorry for myself.&quot;</p>\n<p>Natt looks surprised and nods slowly. </p>\n<p>&quot;...And I try not to think about it too much.&quot; You can hear how fake it sounds.</p>\n<p>&quot;Right.&quot; Natt gently pat your back. &quot;Well, I&#39;m here for you if you need anyone, Aki. I work from home, so you can almost always find me here.&quot;</p>\n<p>You chuckle. &quot;Your spouse will be jealous if you spend so much time with me.&quot; You decide to not mention Rugby.</p>\n<p>Natt simply smiles at your words and adds several more pats to your back. You feel something well up inside of you, but the most you let yourself do was choke a bit. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition1\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=1","sympathy=true"],
		'passages': {
		},
	},
	'attachment': {
		'text': "<p>&quot;At least I can still see them as a Spirit.&quot;</p>\n<p>You reply, half as an attempt to comfort yourself. You can still have them around. Even though they do lack a physical form, it’s still much better than not getting to see them at all.</p>\n<p>&quot;That&#39;s what the technology is here for, right?&quot; Natt points to the Projection ball on the ceiling. &quot;It&#39;s kind of embarrassing to admit that you can&#39;t get over someone, but sometimes you just can&#39;t.&quot; The look on Natt&#39;s face suggest that they are thinking about Rugby. &quot;And even as a Spirit, Rugby is exactly the same.&quot;</p>\n<p>You stand up and approach the card reader. The mode is at &quot;OFF&quot; right now, which you turn back to &quot;ON&quot;. Rugby instantly shows up where he disappeared last time, still sitting obediently in one spot. He looks at you eagerly, wanting to play.</p>\n<p>&quot;Aki-&quot;Before Natt could speak, you interrupt them. &quot;You don&#39;t have it hide it around me, I want to play with the old pal too.&quot;</p>\n<p>And as the Dalmatian plops to their digital belly, their tail going in a windmill of excitement, you begin to feel a bit better.</p>\n<p>You wonder if your other half is at home waiting for you, too.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition1\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=1","attachment=true"],
		'passages': {
		},
	},
	'transition1': {
		'text': "<p>{if seen sympathy:You and Natt spend the entire afternoon reminiscing your childhood.} {else: You and Natt spend the rest of the afternoon playing with Rugby.}</p>\n<p>When it was time to leave, Natt envelopes you in a bear hug. “Don’t be a stranger, eh?” You nod, feeling happier for the time spent with them.</p>\n<p>You leave the apartment feeling some of the weight being lifted off your shoulders.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition2\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'CyBeer': {
		'text': "<p>CyBeer</p>\n<p>You manage to squeeze through the crowds on the streets and into the <a class=\"squiffy-link link-passage\" data-passage=\"alleyway\" role=\"link\" tabindex=\"0\">alleyway</a> where CyBeer is. The bell rings as you enter. </p>\n<p>The pub has a warm, orange lighting with sofas and wooden chairs and tables laid out casually across the floor. The interior decor resembles old-school &quot;American pubs&quot; that you would see on TV, a sharp contrast from stylish, techno bars and pubs you see more and more of these days.&quot;Akihiro!&quot;Anival exclaims as they see you. You can’t help but smile at their enthusiasm and sit down by the bar table in front of them. Your usual spot.</p>\n<p>&quot;Long time no see! How have you been?&quot;</p>\n<p>Anival sends a big smile on your way, and makes their arms dance between different bottles of alcohol. A <a class=\"squiffy-link link-passage\" data-passage=\"Rob Roy\" role=\"link\" tabindex=\"0\">Rob Roy</a> is in front of you in the blink of an eye. </p>\n<p>&quot;It&#39;s on the house.&quot; Anival says with a playful wink. </p>\n<p>You take a sip of the cocktail and order the chicken club sandwich.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=2","pub=true"],
		'passages': {
			'alleyway': {
				'text': "<p>The alleyway is tiny and inconspicuous, but once you step inside it is like another dimension. There are exaggerated neon arrows pasted onto the walls of the alleyway leading to the pub, and along the way you see <a class=\"squiffy-link link-passage\" data-passage=\"banners\" role=\"link\" tabindex=\"0\">banners</a> and <a class=\"squiffy-link link-passage\" data-passage=\"spray paint\" role=\"link\" tabindex=\"0\">spray paint</a> continuing all the way to the very <a class=\"squiffy-link link-passage\" data-passage=\"door of the pub\" role=\"link\" tabindex=\"0\">door of the pub</a>. </p>",
			},
			'banners': {
				'text': "<p>Based on its juvenile font style and random doodles on the side, they are clearly handmade.</p>",
			},
			'spray paint': {
				'text': "<p>Says &quot;GRAB A BEER&quot; &quot;BEER THIS WAY&quot;. They are all in green. Whoever made it either really likes green or can only afford one color.</p>",
			},
			'door of the pub': {
				'text': "<p>The door is wooden and painted a dark red. You can see how long the door has been used because there are signs of decay. You know that it must be pushed gently, because otherwise it would break and you would have to compensate. </p>",
			},
			'Rob Roy': {
				'text': "<p>Anival&#39;s specialty cocktail. You generally don&#39;t like any cocktail with Scotch or vermouth in it, but their Rob Roy has a refreshing, lemon aftertaste that makes it a lot more enjoyable. You know the secret is in the ice cubes made with lemon juice. </p>",
			},
		},
	},
	'_continue11': {
		'text': "<p>Anival is a master at observing people. You can tell they’re trying to entertain you out of your misery. As you chow down on the scrumptious sandwich, you absent-mindedly listen to Anival&#39;s recent story about a one-time hook-up that involved something way kinkier than they&#39;ve ever imagined. It apparently involved something being plunged into somewhere where it shouldn&#39;t, but considering you have food in your mouth, you decide not to press for detail.</p>\n<p>You realize that the more you eat the more hungry you become, and you remember that you haven&#39;t eaten since yesterday. After licking your finger clean of the chicken grease, you order a second sandwich. </p>\n<p>Anival glances at you with a raised brow before making another cocktail--this time a <a class=\"squiffy-link link-passage\" data-passage=\"XYZ\" role=\"link\" tabindex=\"0\">XYZ</a>.</p>\n<p>&quot;You know, for a beer pub you make a lot of fancy drinks.&quot; You swirl the liquid in the glass, starting to feel the pleasant buzz of alcohol kicking in. </p>\n<p>&quot;It gets boring if all people order is beer.&quot; Anival shrugs. &quot;Since I&#39;m going all out on giving you free drinks, might as well make something I want to make.&quot; They trace their finger on the beer nozzle and taps it lightly, drawing attention to their silver nail polish.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'XYZ': {
				'text': "<p>You guess that the Anival is going for a theme by making a XYZ, a cocktail with lemon juice as one of the ingredients. </p>",
			},
		},
	},
	'_continue12': {
		'text': "<p>The second sandwich is larger and thicker than the first one you ordered, with additional eggs and even a few slices of bacon wedged between the slices of bread. Anival pretends that they don&#39;t know what you are talking about. </p>\n<p>As you are biting your way through the sandwich, you hear the voice of a drunkard echoing inside of the bar. </p>\n<p>&quot;I lost my only family to the Plague!&quot; <a class=\"squiffy-link link-passage\" data-passage=\"The drunkard\" role=\"link\" tabindex=\"0\">The drunkard</a> bellows, making everyone&#39;s head turn towards them. The waiter is trying, but failing, to calm them down. They toss a desperate look towards Anival.</p>\n<p>&quot;Geezus.&quot; Anival sighs. &quot;They&#39;ve been here since 9 this morning. Kept complaining about the Plague and how their kid died.&quot;</p>\n<p>You nod and finish off the cocktail.</p>\n<p>&quot;Everyone&#39;s like &#39;Oh they are Spirits now&#39;, &#39;You can make them be happy&#39;, but guess what, I was an asshole! The kid&#39;s never been happy! And as a Spirit they still aren&#39;t fuckin&#39; happy, no matter how.hard.I&#39;m.trying.&quot; They grit their teeth as they emphasize the last words.</p>\n<p>&quot;And now the kid&#39;s at the Room everyday, being scared.&quot; The drunkard spills the beer everywhere on the table, wielding it like a club against people around him. Anival hurries out from behind the counter and, with the help of other waiters, pushes them out the door. &quot;Did you know as a Spirit, nothing ever fuckin&#39; changes for them? I bet I could make up for it if the kid&#39;s alive, y&#39;know. But I&#39;ve lost that kid forever.&quot; The drunkard starts laughing as they get the door slammed in their face. &quot;FOREVER!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'The drunkard': {
				'text': "<p>The drunkard seems to be middle aged, but has defined facial features. They have a scruffy look to them that would make them quite attractive. That is, if they did not reek of alcohol and were not red-faced. </p>",
			},
		},
	},
	'_continue13': {
		'text': "<p>Just when you thought your mood was getting better, that episode kicked all the alcohol out of you. Anival is in the middle of the pub, apologizing to everyone and handing out free beers.</p>\n<p>You decide to stay behind and help Anival clean up. It is the first time that you have seen Anival so serious and apologetic, but after everything they&#39;ve done for you, you felt like helping them out is the least you can do to return the favor.</p>\n<p>The sun is already beginning to set by the time you finish. Your skin is particularly sensitive to these cold winds.. Clutching some burgers that Anival insisted on shoving your way, you quickly scurry home to shelter both yourself and the food from the cold. Despite what happened, at least your stomach won&#39;t be empty tonight.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition2\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'Home': {
		'text': "<p>The more you think about your lover, the more eager you are to see them again. It doesn&#39;t matter if they are a Spirit, it doesn&#39;t matter if you can&#39;t touch them, you just needed to know that they exist <i>somewhere</i> in this world. </p>\n<p>You quicken your pace.</p>\n<p>The last time you felt them was on the hospital bed. You call to mind how they were when they were alive. You remember their touch, their skin against yours, the clean smell of their shirt as you hugged them goodbye for work. It&#39;s ok, you remember them. So it would be fine to allow yourself to see them as a Spirit so soon, right?</p>\n<p>Before you realize it, you are sprinting towards your apartment.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition2\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=2"],
		'passages': {
		},
	},
	'transition2': {
		'text': "<p>Rummaging through your bag, you fumble with the keycard to your apartment. Your heart is pounding wildly, the keycard slipping in sweaty hands.</p>\n<p>What if your lover is already there in the <a class=\"squiffy-link link-passage\" data-passage=\"Projection Room\" role=\"link\" tabindex=\"0\">Projection Room</a>? Will you really see them?</p>\n<p>You press the card against the sensor and push open the door with a faint click, turning on your lights in your apartment.</p>\n<p>{if seen Home:As you as you turn on the lights, you drop your bags and dash to the Projection Room.}</p>\n<p>{if attachment=true:Although you still feel somewhat afraid to see your other half as a Spirit, you recall Natt&#39;s reaction to their dog, Rugby, and slowly walk into the Projection Room.}</p>\n<p>{if sympathy=true:You are not sure if you are ready to see them just yet. You hesitate in front of the Projection Room and do not immediately push the door open. Even though you know that you will see them sooner or later as a spirit, you still stall for time and attempt to make some coffee to calm yourself down a bit first. </p>\n<p>With a cup of coffee in hand, you take a deep breath and turn the knob.}</p>\n<p>{if pub=true:Setting the food you got from Anival on the kitchen counter, you find yourself thinking about the drunkard&#39;s words. What did he mean by Spirits not changing?  You have not thought about spirits that way, what if it&#39;s true? What if there is something concrete that is lost once your other half stops being human? </p>\n<p>You hear voices of coming from the Projection Room. It must be your parents. After a moment of hesitation, you step decisively into the room. Either way, you are about to find out.}</p>\n<p>&quot;Aki!&quot; Your parents immediately call out to you. They seem to be doing some cooking in the Spirit Realm. There is no sight of your lover.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">&quot;Hey Mom and Mother.&quot;</a></p>",
		'passages': {
			'Projection Room': {
				'text': "<p>Installed in (almost) every single standard apartment in the city. Once the spirit&#39;s presence is captured by the Connection, the visual data is transmitted into a hologram projection in this room. The government system will automatically project their presence to the Projection Room of the person the particular Spirit wants to see the most. The environmental data as well as what you say will also be transmitted to the Spirit, allowing them to Communicate with you. The Connection is difficult to cut off, so it is always on by default in order to respect the Spirit&#39;s wishes. Everyone has the right to temporarily block the signal by making small payments to services online.</p>",
			},
		},
	},
	'_continue14': {
		'text': "<p>Both of them smile and give you an air hug. &quot;I have to say,&quot; your mother says. &quot;I am really enjoying the new cooking equipment you got me. It&#39;s one of the best <a class=\"squiffy-link link-passage\" data-passage=\"Offerings\" role=\"link\" tabindex=\"0\">Offerings</a> I&#39;ve received so far.&quot; They poke their wok towards you, and of course, it goes right through your body.</p>\n<p>&quot;Your mother has been cooking me very good meals from that wok.&quot; Your mom comments, rubbing their belly. &quot;Lemme tell ya, it&#39;s good that Offerings let us enjoy food like we used to. Goodness knows how I’d miss your mother’s cooking!&quot; They bring your mother into their arms, and they snuggle.</p>\n<p>You smile at them in response. You’re lucky to have such a loving couple in your Projection Room. You heard stories of Spirits as parents stirring chaos in the house. </p>\n<p>&quot;There is one thing though.&quot; Your mother seems to remember something. &quot;I&#39;m running out on chicken stock, can you please get me some?&quot;</p>\n<p>&quot;Mother, you know that I&#39;ve been spending a lot of time in the hospital.&quot;\nYou try to say in a stern voice. You have been trying your best to accommodate your parents’ requests for Offerings, but you live in the here and now. Your hours dedicated to caring for your lover in the hospital have cut dangerously into your work time leaving your funds dangerously low.This just wasn’t a good time to buy them the Offerings they asked fors. </p>\n<p>&quot;We won’t ask again for a while after this.&quot; Mom tries to persuade you.</p>\n<p>{if pub=true:<i>Spirits don&#39;t change</i>, you hear once again in your head. Spirits don&#39;t seem to adapt to situations and keep asking for Offerings. Is their lack of a corporeal body causing an inability to with sympathize with temporal troubles? You try to remember if your parents were ever like this when they were still alive.}</p>\n<p>You think for a bit, and say:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"yes1\" role=\"link\" tabindex=\"0\">&quot;Yes&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"no1\" role=\"link\" tabindex=\"0\">&quot;No&quot;</a></p>",
		'passages': {
			'Offerings': {
				'text': "<p>Companies are now able to make objects that simulate reality and transmit them to the Spirits, making their lives in the Spirit Realm easier. People who are still alive can choose to buy these objects and send them to the Spirits, who can touch and use these objects. Every object that exists in reality has a equivalent Offering. The price of these Offerings are decided by how difficult it was to make. Some cultures in the past would burn paper as Offering, but the science has proven that to be ineffective in reaching the Spirit Realm.</p>",
			},
		},
	},
	'yes1': {
		'text': "<p>&quot;Yes.&quot;</p>\n<p>As frustrated as you are, they are, afterall, your parents. They were, and still are, good parents to you, and it’s hard denying them what they want.</p>\n<p>You sigh before walking towards the card reader near the entrance of the room, and swiping your credit card. A screen pops in front of the card reader. Scrolling down to find &#39;chicken stock&#39;, you hit the Purchase button.</p>\n<p>When you turn around, your mother is already holding a big can of chicken stock. It’ll probably last for a while, and you do feel somewhat compensated seeing how happy it makes your mother. They are blathering on about not being able to make good soup without chicken stock, and gradually the conversation between your parents turn into a conversation about the best chef in the Spirit Realm.</p>\n<p>As they talk, you scan the room for your significant other. You find it strange that they around yet, especially since it’s almost been an entire day since they have passed away. You’ve heard of Spirits taking over 24 hours to appear through the Connection but such cases are extremely rare. \n&quot;Are you listening to us? Aki?&quot; Your mother waves the wok in front of your face. You jerk backwards as a natural reflex.</p>\n<p>“No, no, I’m listening,” you say, eyes still scanning the room. “I just expected…”</p>\n<p>&quot;Is someone else is going to come to this room?&quot; Mom asks as they scrutinize your face. &quot;I seem to feel another person being Connected.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition4\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=1"],
		'passages': {
		},
	},
	'no1': {
		'text': "<p>&quot;No.&quot;</p>\n<p>&quot;No means no, mother.&quot; You try not to sound too annoyed at them. {if variable&lt;-3:&quot;I don&#39;t want to say this, but I need the money to live for a bit longer.&quot; Your parents seem to be rather taken back by your words.}{else:&quot;I feel bad, I really do, Mother. But I&#39;ll buy you more things after I return to work, ok?&quot;}</p>\n<p>&quot;If you insist on putting it that way...&quot; Your mother looks somewhat hurt by your rejection, but in a situation where you need the money more than them, you feel like you need to put your foot down this once. As much as you want to make their afterlife comfortable, this is not the right time to discuss their happiness.</p>\n<p>You scan the room once more, and you notice that there are still no signs of your lover. It&#39;s been a whole day since they passed away, and the Connection has never been this slow.</p>\n<p>&quot;Is there something wrong, Aki?&quot; You mom seems to notice your slight anxiety. &quot;Are you looking for someone here? I did seem to feel another Spirit being connected in just earlier today.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition4\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=1"],
		'passages': {
		},
	},
	'transition4': {
		'text': "<p>&quot;You feel that someone is going to be here?&quot; You ask, surprised that Spirits can do something like that.</p>\n<p>&quot;Not normally.&quot; Your mom looks to a corner of the room. &quot;But I&#39;ve been hearing some interferences in the Projection here since last night.&quot;</p>\n<p>&quot;Interferences?&quot;</p>\n<p>&quot;You know, now that you mention it,&quot; pipes your mother. &quot;I&#39;ve been hearing some voices in here too. Although I thought it was other spirits that accidentally got into this Projection Room.&quot;</p>\n<p>You have never heard of such a phenomenon happening before. You think about the possibility of the G.D.O Tower trying to reach out to multiple Spirits at once due to the Plague, and the heavy traffic causing increased difficulty in locating the Spirits. </p>\n<p>&quot;But if there is someone new that you are expecting, Aki.&quot; Mom looks at you. &quot;Maybe you should check back to see tomorrow.&quot; They hover a hand above your cheek. &quot;You look tired.&quot; They say quietly. &quot;Maybe you should rest for today, there isn&#39;t much to worry about.&quot;</p>\n<p>During times like this, you wish that Spirits were tangible. Mom was always the more perceptive one with a much calmer disposition. After hearing their words, you suddenly feel a wave of drowsiness. You haven&#39;t felt this tired in a long time. &quot;Yeah.&quot; You try and put your hand on theirs too. &quot;Maybe I should.&quot; </p>\n<p>And with that, you exit the Projection Room with your parents&#39; good night wishes. You stumble through your studio and collapse upon the bed. You didn&#39;t think you would be able to sleep with all that has happened, but your eyes are so heavy. Right before you doze off, you think you see the G.D.O Tower stop glowing for a split second.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>You wake to sunlight searing through your window and realize you forgot to close the blinds last night. Glancing at the <a class=\"squiffy-link link-passage\" data-passage=\"clock\" role=\"link\" tabindex=\"0\">clock</a>, you grumble before stumbling out of bed and into bathroom. You’ve just started brushing your teeth when you hear a startled yell from your mother in the Projection Room.</p>\n<p>&quot;Who are you? Aki! Are you in the house?&quot;</p>\n<p>With your toothbrush still in your mouth, you rush to the Projection Room.\n&quot;What&#39;s going on?&quot; You rush into the room, wielding your toothbrush like a weapon, and freeze as you see the newly added Spirit in the room.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'clock': {
				'text': "<p>A clock that looks like a small robot, with the current time displaying on the center of its chest. It says 10:17 am.</p>",
			},
		},
	},
	'_continue16': {
		'text': "<iframe width=\"100%\" height=\"70\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/42181071&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>\n\n<p>Blonde, short hair, skinny, yellow hoodie, and slightly slouched. The Spirits looks back at you in surprise and you have a fleeting moment of distaste at how gormless you look when surprised before it’s drowned by overwhelming shock.</p>\n<p>&quot;What?&quot; Both of you gasp in unison.</p>\n<p>What is the first thought on your mind?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Not you\" role=\"link\" tabindex=\"0\">&quot;This cannot be me&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You\" role=\"link\" tabindex=\"0\">&quot;Have I died?&quot;</a></p>",
		'passages': {
		},
	},
	'Not you': {
		'text': "<p>&quot;This cannot be me.&quot;</p>\n<p>You stare at the hologram version of yourself and pinch your own hand. It&#39;s warm. It hurts. It confirms that you’re alive, you’re awake, and you have no idea what that Spirit is, and why it’s staring at you with the same wary uncertainty.</p>\n<p>&quot;Why are you here?&quot; You speak at the same time again. </p>\n<p>&quot;Okay, shut up for a second.&quot; The hologram holds up their hand. </p>\n<p>You instantly feel anger welling up at you, but you comply, because you agree that this conversation is essentially moot without any exchange of information.</p>\n<p>For now, you decide to listen to what the Spirit has to say.</p>\n<p>You appreciate that both of your parents are remaining silent as well.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition5\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=1"],
		'passages': {
		},
	},
	'You': {
		'text': "<p>&quot;Have I died?&quot;</p>\n<p>You instantly try to confirm by pinching yourself on the leg. It does hurt. You then proceed to pat yourself everywhere to double-check, and you finally think that you are 100% corporeal.</p>\n<p>Then what, or <i>who</i>, is the Spirit in front of you?</p>\n<p>The Spirit approaches you, and starts walking around you in a circle. They seem to be scrutinizing you carefully, because you can see their eyes going up and down your body. You resist the urge to cover yourself with your hands. It’s a ridiculous thought, especially in this situation.</p>\n<p>It both confuses and disconcerts you that the &#39;you&#39; in front of you is not imitating your own actions, like the &#39;you&#39; in the mirror would do. </p>\n<p>You try your best to observe their actions as they walk around you as well, trying to find any indication that this Spirit is not &#39;you&#39;. But even after a thorough inspection, you still think that this is way past an &#39;uncanny resemblance&#39;. </p>\n<p>The Spirit is exactly the same as you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition5\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=1"],
		'passages': {
		},
	},
	'transition5': {
		'text': "<p>The Spirit seems to be contemplating something, with eyes darting back and forth between you and your parents. You wait for them to speak.</p>\n<p>After a long silence, the Spirit asks &quot;What date is it today?&quot;</p>\n<p>&quot;December 10th.&quot; Your mother answers before you check your phone. The Spirit nods, and then looks at you in the eyes. You wonder if this is what you look like when you look at other people. </p>\n<p>&quot;I thought I had died two days ago.&quot; The Spirit sits down on the floor. &quot;In the hospital bed.&quot; </p>\n<p>You remember that the reason why you came to this room in the first place was because you wanted to check if they have emerged as a spirit. They have not. There are no other Spirits besides your parents, and the Spirit that looks and acts like yourself. </p>\n<p>{if variable&lt;-2:You were not even sure that you wanted to see your lover as a Spirit in the first place, but now, not seeing them around at all seems be taking a much bigger toll on you than you thought.}{else:You start to wonder if you will ever get to see your significant other again. A chill set in at the thought.}The new Spirit doesn&#39;t seem to know why you are acting this way.</p>\n<p>&quot;It&#39;s not you...not me, that died.&quot; You clear your throat before continuing. &quot;It&#39;s...it&#39;s my...&quot; The words are stuck at the tip of your tongue.</p>\n<p>It took the Spirit a second to realize who you meant. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<p>This must have what you looked like when you saw your loved one die. Seeing your emotions mirrored upon another’s face,  you realize it’s somewhat comforting for someone to share your feelings.</p>\n<p>Still, just leaving the matter as it was wasn’t a solution. Hesitatingly, you fill the Spirit in on the correct details.  The Spirit is frowning as you finish.. According to them, it was you that was diagnosed with the Plague. And it was the significant other who visited you every day.</p>\n<p>Your parents remain silent through the whole affair. They seem to be immersed in their own thoughts. </p>\n<p>&quot;What do you make of this, honey?&quot; Your mother breaks the silence and turns toward your mom. </p>\n<p>&quot;I don&#39;t think I remember much about when I died,&quot; your mom says.</p>\n<p>&quot;Neither do I.&quot; Your mother taps her chin thoughtfully. &quot;It is all quite blurry, but we have never talked about this with anyone.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue18': {
		'text': "<p>Their conversation caught both of your attention. &quot;What do you mean, we?&quot; you ask. &quot;You mean, &#39;we&#39;, as in Spirits?&quot;</p>\n<p>&quot;I....don&#39;t know.&quot; Your parents seem to be troubled by something, glancing at one another. &quot;But this is definitely strange, since Aki hasn&#39;t died, there should not be a <i>Connection</i> to begin with.&quot;</p>\n<p>&quot;Not to mention that-” you wave vaguely at the Spirit “-this, other me’smemory is disjunct. If it is really my Spirit, the memory should be consistent, but it&#39;s not. It&#39;s mixed with my lover&#39;s memory, it seems like.&quot;</p>\n<p>&quot;But their Spirit is nowhere to be found.&quot; The Spirit has begun to pace the room in frustration. &quot;It seems like I&#39;m here in their place, but how can that be when they are the one who passed away.&quot;</p>\n<p>You think of another possibility:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"not dead\" role=\"link\" tabindex=\"0\">&quot;Are they not dead?&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"not spirit\" role=\"link\" tabindex=\"0\">&quot;Are you actually not a Spirit?&quot;</a></p>",
		'passages': {
		},
	},
	'not dead': {
		'text': "<p>&quot;Are they not dead?&quot; </p>\n<p>A spark of hope jumps to life inside you. &quot;Is that a possibility?&quot;</p>\n<p>The Spirit nods. &quot;There’s no reason it can’t be. But it doesn&#39;t explain why I am here.&quot; They look at their hands. &quot;If they aren’t dead, there has to be something happening here.&quot;</p>\n<p>The more you think about the situation, the more unnatural it seems to be. You want to believe that your lover is not actually dead, but if that is the case, why are they declared to be dead? Why aren&#39;t they here, with you?</p>\n<p>Everyone in the Room is silent now. This entire situation just creates a giant swirl of confusion within you, but the possibility that your lover might still be alive, however slim, seems to give you a bit more momento to think.</p>\n<p>If they are alive, you have to find them.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition6\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=1"],
		'passages': {
		},
	},
	'not spirit': {
		'text': "<p>&quot;Are you actually not a Spirit, then?&quot;</p>\n<p>&quot;What do you mean, not a Spirit.&quot; Your parents seem agitated by your words. &quot;The way they are here is completely-&quot;</p>\n<p>&quot;Mother.&quot; The &#39;Spirit&#39; shuts them off. &quot;The &#39;Connection&#39; here is just a conduit between here and the spiritual realm, it &#39;connects&#39; something. Maybe it connected something else. Another dimension, a parallel universe...It&#39;s all possible.&quot; After a brief pause, they continue. &quot;Or...I might not be anything at all, and something happened to make me here right now.&quot;</p>\n<p>It’s rare to have someone this cooperative and you find yourself growing fond of this new addition to your Projection Room. You know that it must be difficult for them to admit that they are not &#39;you&#39;, but rather something or someone else.</p>\n<p>Whatever they are, you want to find out why the &#39;Connection&#39; chose to connect to them instead of your significant other.</p>\n<p>You hope that the &#39;Spirit&#39; understands what you need to do long enough to cooperate.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition6\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=1"],
		'passages': {
		},
	},
	'transition6': {
		'text': "<p>&quot;We need to figure out what’s going on here..&quot; A million possibilities run through your mind.  There are a lot of things that you need to confirm, starting with a the existence of this new Spirit standing in front of you. </p>\n<p>The Spirit seems to be in agreement with you. Your parents are apologetic that they cannot be of any help. Spirits live in the <a class=\"squiffy-link link-passage\" data-passage=\"Spiritual Realm\" role=\"link\" tabindex=\"0\">Spiritual Realm</a>, another dimension, only coming into your world when the Connection is established. </p>\n<p>&quot;Since you are not Aki,&quot; Your mother suggests. &quot;Maybe we should give you a new name, to avoid confusion.&quot;</p>\n<p>&quot;What about Fuyuhiro. We&#39;ve decided to name our second child that before!&quot; Your mom exclaims. </p>\n<p>They both seem delighted by the addition of a second ‘child’. ‘Fuyuhiro’ and you sigh, and you’re somewhat creeped out by how in unison you are with them. ou wonder how your parents are so chipper. It seems like nothing can trouble for more than a few minutes. They were calmer when alive so perhaps it is the perks of being a Spirit.</p>\n<p>&#39;Fuyuhiro&#39;, however, seems to be an exact replica of you, down to their behaviour. Maybe it depends on the person and the Spirit. \nAt least, this Fuyuhiro in front of you can help you brainstorm your next action.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'Spiritual Realm': {
				'text': "<p>Spirits don&#39;t seem to prefer to talk about the Spiritual Realm that much, except that they are able to live a life similar to when they are alive with the Offerings made to them. Nothing seems to be corporeal there, and Spirits can no longer feel anything that was biological innate, such as hunger, thirst, exhaustion, and so on. Researchers are currently attempting to venture to the Spiritual Realm, or at least be able to Connect to it, but since current technology can only establish Connections through identifying similar energy matters on life, it is not possible for the time being.</p>",
			},
		},
	},
	'_continue19': {
		'text': "<p>&quot;There are a lot of things that we can do,&quot; said Fuyuhiro, walking about in the Room. &quot;It depends on what you want to prioritize.&quot; </p>\n<p>There only seems to be two choices so far. The <a class=\"squiffy-link link-passage\" data-passage=\"hospital\" role=\"link\" tabindex=\"0\">hospital</a> or the <a class=\"squiffy-link link-passage\" data-passage=\"G.D.O Tower\" role=\"link\" tabindex=\"0\">G.D.O Tower</a>. </p>\n<p>What do you choose?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Hospital\" role=\"link\" tabindex=\"0\">Hospital</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"GDO\" role=\"link\" tabindex=\"0\">G.D.O Tower</a></p>",
		'passages': {
			'hospital': {
				'text': "<p>As much as you want to believe that your lover is not dead, you still remember everything that happened in the hospital yesterday. Still, you can’t help but think that maybe there is actually some huge conspiracy involved and they’re out there somewhere, alive.</p>\n<p>Dr.Lee hasn&#39;t called you about the paperworks yet. You can still go speak to them about your lover&#39;s death and confirm.</p>\n<p>Besides, you promised to bring that kid some more fruit.</p>",
			},
			'G.D.O Tower': {
				'text': "<p>&quot;I don&#39;t much how much longer I’ll be here,&quot; said Fuyuhiro, looking down at their own hologram. They seem anxious. You decide not to comment, knowing they would prefer to be left alone on this. &quot;At least while I’m here, we can investigate. We are programmers after all, so maybe I can use a computer to check something up on this end while you go to the G.D.O Tower and <a class=\"squiffy-link link-passage\" data-passage=\"get into the system\" role=\"link\" tabindex=\"0\">get into the system</a>.&quot;</p>\n<p>You sigh. That means they are asking you to buy a computer for them. You check your funds and wince but can hardly afford to be stingy in this situation.</p>\n<p>Though still technically on break, you still have access to your work computer. You can also ask some of your coworkers if there has been any glitches with the system.</p>",
			},
			'get into the system': {
				'text': "<p>You are the newest addition to the maintenance team, checking to see if there are errors on the codes connecting the Spirits to their loved one&#39;s Projection Rooms. Though usually error-free since all the codes are pre-written, sometimes Development tries to add new Offerings to the system and it is your team that needs to deal with the problems that arise. You were assigned to this team because, as a rookie, you would need to grow accustomed with the data structure, but you&#39;d never thought gaining access to the codes would come in handy like this.</p>",
			},
		},
	},
	'Hospital': {
		'text': "<p>You decide to drop by the hospital to see Dr.Lee. You quickly make a call for an appointment and, luckily, the usually busy doctor is currently processing your lover&#39;s paperworks. They agree to meet you in their office in an hour.</p>\n<p>On the way to the hospital, you drop by a supermarket to pick up some <a class=\"squiffy-link link-passage\" data-passage=\"fruit\" role=\"link\" tabindex=\"0\">fruit</a>. </p>\n<p>You decide to drop by the hospital to see Dr.Lee, making a quick call for an appointment and, luckily, the usually busy doctor is currently processing your lover&#39;s paperworks. They agree to meet you in their office in an hour.</p>\n<p>On the way to the hospital, you pick up some <a class=\"squiffy-link link-passage\" data-passage=\"fruit\" role=\"link\" tabindex=\"0\">fruit</a>, wondering if the child has a favourite. </p>\n<p>You have always found the outer appearance of the hospital intimidating. It’s where people &#39;transform&#39; into Spirits, and where they get <a class=\"squiffy-link link-passage\" data-passage=\"cremated\" role=\"link\" tabindex=\"0\">cremated</a> and returned to the soil. You’d prefer never having to set foot here again but there is something you need to know today.</p>\n<p>&quot;Akihiro.&quot; <a class=\"squiffy-link link-passage\" data-passage=\"Dr.Lee\" role=\"link\" tabindex=\"0\">Dr.Lee</a> gives you a smile and a polite nod as you walk into their office. &quot;Are you feeling better? I saw your note, so I thought I wouldn&#39;t hear from you for another couple of days.&quot; They gesture towards a chair in their office. “Please, sit.” </p>\n<p>You accept with a quiet thanks. &quot;I feel...weird. Thanks for seeing me on such short notice.&quot;</p>\n<p>&quot;It’s not a problem. You’ve always been understanding and kind, and that&#39;s a rare feature, especially at a time like this.&quot; You realize that they are talking about the Plague, and decide not to ask. They rub their eyes and sigh deeply. “Times like these...they bring out the worst in us.” They smile crookedly. “Of course, you didn’t come in today to hear me complain. What can I help you with?”</p>\n<p>Right now is not the time to tell Dr.Lee what has happened with your own Spirit. You and Fuyuhiro had agreed that keeping their existence a secret was crucial. \n&quot;I&#39;ve heard rumors amongst the patients.&quot; You try not to look too hopeful but it’s hard. &quot;They were saying that people diagnosed with the Plague may not actually be dead.&quot;</p>\n<p>It is probably the first time you have seen the doctor look so exasperated.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=1"],
		'passages': {
			'fruit': {
				'text': "<p>You have not forgotten your promise with the kid. Even though you have never seen them eating the fruits, they must like them to make you promise to bring them some again. You try to dig out some things your lover has told you about the kid from the back of your memory, and you remember that you have not brought them any fruit this winter.</p>\n<p>You decide to pick up some oranges and persimmons. Hopefully they will like them.</p>",
			},
			'cremated': {
				'text': "<p>Historically, the cremation process organized through a &#39;cemetery&#39;. This process was quickly taken over by hospitals when the Connection opened its access to civilians, making it much more affordable, taking much of the meaning out of venerating the deceased. Soon, all lands dedicated to that ceremony were taken for government use  although one of two were still preserved as a part of a museum. Since the Connection access is strictly granted by the government, hospitals also took over the Death Certificate process.</p>",
			},
			'Dr.Lee': {
				'text': "<p>Despite how busy they must have been, Dr.Lee still takes care to look presentable, unlike some of the other doctors you have seen around this hospital. </p>",
			},
		},
	},
	'_continue20': {
		'text': "<p>&quot;It is simply not possible.&quot; Dr.Lee says with a stern expression. &quot;If the fact that the heart stops beating for more than a day, with the body slowing starting to decay is not an indication of death, I don&#39;t know what is. Please don&#39;t tell me that you believe this, Akihiro.&quot;</p>\n<p>&quot;I don&#39;t.&quot; You try to ignore the look that the doctor is sending your way, and continue. &quot;But I want some proof that they are dead, I guess. I mean, actually.&quot;</p>\n<p>&quot;Does a Death Certificate not suffice?&quot;</p>\n<p>&quot;No.&quot; By this time you are no longer putting up a pretense, feeling earnestly anxious. &quot;I would like to see the cremation, I hear that the hospital does it after 2 days of death.&quot;</p>\n<p>Dr.Lee’s eyes widen. &quot;That...is not for unauthorized personnels.&quot; They turn away, shuffling the papers on their desk. “I think it’d be better if you left.”.</p>\n<p>&quot;I know, but I just..really want to confirm.&quot; Your hands are shaking. &quot;I couldn&#39;t bring myself to see if their Spirit is here yesterday, bearing the thought that they may not be dead. And I have to go back to work at G.D.O soon, and I can&#39;t work like this.&quot;</p>\n<p>&quot;But Ak-&quot;</p>\n<p>&quot;Please doctor,please.&quot; Your voice cracks. The emotion is genuine now. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'text': "<p>It takes over an hour of relentless begging for Dr.Lee to agree, begrudgingly granting you access to watch the cremation through a security camera for 10 minutes under their supervision. The doctor usually oversees the operation at the cremation spot, but there was no way that Dr.Lee would leave you alone in the security room. It is better than nothing.</p>\n<p>“The cremation will start at 4,” they grumble. “Come back to find me then.” </p>\n<p>You leave without protest, feeling drained by the conversation. . Having some time to kill, you head to the <a class=\"squiffy-link link-passage\" data-passage=\"kid's room\" role=\"link\" tabindex=\"0\">kid&#39;s room</a> and drop off the fruit you got. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'kid\'s room': {
				'text': "<p>The kid is sleeping again. You wonder if they have been sleeping since yesterday. You don&#39;t know how long they will keep sleeping, but you peel and cut the fruit into little pieces all the same, and place it next to them, hoping they will wake up and eat the fruit while it is still fresh.</p>",
			},
		},
	},
	'_continue22': {
		'text': "<p>You don&#39;t know how to feel, seeing your lover&#39;s dead body once again. You feel your heart break again as the truth shoves itself in your face. Their face looks more lifeless than yesterday, and it hurts more than ever.</p>\n<p>You try your best to stop tears from welling in your eyes. There are three operators in the <a class=\"squiffy-link link-passage\" data-passage=\"cremation area\" role=\"link\" tabindex=\"0\">cremation area</a>. One seems to be examining the body, and one seems to be checking up on the furnace. The third one is looking at the computer, and you recognize the window on the computer screen as the G.D.O server.</p>\n<p>You try to pry your eyes away from your loved one to look at the computer screen closely, but since the camera is installed high, you could not make anything out.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'cremation area': {
				'text': "<p>The area is plain. There is a big furnace in the center of the room, enclosed by a metal door. All the operators are wearing face masks and short sleeves. Other than that, the only other thing present in the room is a work desk and a computer, as well as the gurney that carries your lover&#39;s body.</p>",
			},
		},
	},
	'_continue23': {
		'text': "<p>Looking around to divert your attention, you notice the third operator taking a triangular gadget and plugging it into the computer. &quot;What is that?&quot; </p>\n<p>&quot;It&#39;s the energy tracker.&quot; Dr.Lee responds. &quot;The data should be synced now in your Projection Room, but before we cremate the body we need to check once again if the energy is consistent and to avoid any Connection problems in the future.&quot;</p>\n<p>Something clicked in your brain with that bit of information. The energy data could help identify what is going on with the Connection in your house. &quot;So the energy data would be stored in our server, then.&quot;</p>\n<p>&quot;I don&#39;t know much about technical things like this, but I would assume so.&quot; Dr.Lee keeps their eyes on the screen as they talk to you, sticking to their duty. You take this opportunity to gather your thoughts. </p>\n<p>That energy tracking is distributed to people in the Records Team at the G.D.O. You could head to the department and learn more about that how it handles energy tracking, and gain access to the energy data to your lover.</p>\n<p>&quot;Who’s the person from the Record Team?&quot; You ask.</p>\n<p>&quot;Um..Wallace something I think.&quot;</p>\n<p>The Operator seems to be finished checking the energy data, and they do not seem to have spotted any abnormalities. Fuyuhiro&#39;s presence is not detected for some reason.</p>\n<p>You watch your loved one pushed into the fire, and close your eyes. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition7\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'GDO': {
		'text': "<p>It only takes a few minutes  to get to the G.D.O Tower on foot. The door is wide open but the inside is heavily guarded, with broad-shouldered guards, security cameras, and retina scanners at the rooms on the back. You have learned to not be intimidated all of this, telling yourself that you are an <i>authorized personnel</i>.</p>\n<p>You make your way into the Tower, through the retina scanners and up theelevator. You can feel your ears ring and the elevator speeds through to the 25th floor.</p>\n<p>The Tower is always busy, but there’s an extra sense of panic and urgency today. You have not been inside the <a class=\"squiffy-link link-passage\" data-passage=\"office\" role=\"link\" tabindex=\"0\">office</a> since your lover fell ill, but you imagine that the increase of deaths has caused an overload of work for everyone. </p>\n<p>You’re secretly glad that no one expected such a high death count or you never have been granted a break..</p>\n<p>You dodge around the people running back and forth through the office and locate your own desk. You barely touch the chair before someone pats you on the shoulder.</p>\n<p>&quot;You, my friend, are not supposed to be here.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue24\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=1"],
		'passages': {
			'office': {
				'text': "<p>The G.D.O Office is plain. There are no big screens across the walls, and no glowing lights. The only thing impressive about this place is that every single desk has multi-screen computers with the highest specs. The chairs are hard and uncomfortable, and the light is too bright for anyone to fall asleep. Corporate strategies to keep employees working on the Connection system, since transmission does not stop. </p>",
			},
		},
	},
	'_continue24': {
		'text': "<p>You turn around to see your desk buddy, <a class=\"squiffy-link link-passage\" data-passage=\"Aidan\" role=\"link\" tabindex=\"0\">Aidan</a>, looking at your with resentful eyes. &quot;How dare you drop by work to see how everyone is doing, showing off how happy and rested you are. Don’t let me see your stupid face here again.&quot;</p>\n<p>You lift an eyebrow at them. They certainly do more exhausted than usual. &quot;Don&#39;t you think it&#39;s a bit of a mean greeting?&quot;</p>\n<p>&quot;Naw, I&#39;ve been practically living here for the past couple days, Ihaven&#39;t talked to my lover in weeks-&quot; They instantly shut their mouth when they mention their lover, and looks at you with wide eyes of panic.</p>\n<p>You realize that it is a sensitive subject, and you prefer not to talk about it too much, but the way they react to their own words seems so comical that you almost had the energy to laugh.</p>\n<p>A smile tugs at the corner or your mouth instead. &quot;It&#39;s fine. But I&#39;m actually here for something today, are you busy?&quot;</p>\n<p>Aidan jabs at the door of the glass conference room behind him. &quot;Well, the boss just had a big meeting with all of us saying about the possibility of a system overload. And with the amount of dead people energy in the air...&quot; They flit their fingers around. &quot;It is easy to get energy data mixed up, so some of us are assigned to go through verifications of making sure that the there are no mistakes.&quot;</p>\n<p>Despite how exhausted and disheveled they look, you begin to see Aidan in a new light. Aidan may be able to help you in your investigation.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue25\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'Aidan': {
				'text': "<p>Friendly and easygoing, it was easy to become friends with them. They loved to crack jokes even if most people just groaned at how bad they were. They usually wear contacts, but today they seem to be wearing thin framed glasses that you have never seen before. You find a food stain on their hoodie. </p>",
			},
		},
	},
	'_continue25': {
		'text': "<p>&quot;Have you checked the Connection status recently?&quot; You ask Aidan as you turn on the computer screen to your desk. &quot;Any abnormalities?&quot;</p>\n<p>&quot;No as far as I can tell,&quot;Aidan sits down at their own desk and starts fiddling around with lines of code. &quot;But the database gets updated every second, so that can change at any time. To be honest though, we&#39;ve never encountered a case where an energy data could get mixed up. Right now all we are doing is basically verifying if all the energy labelling has changed, other than that, there is nothing much else that we can do really, we can only report it to the higher ups.&quot;</p>\n<p>The Maintenance team incorporates updated Offerings into the system by replacing the <a class=\"squiffy-link link-passage\" data-passage=\"Code\" role=\"link\" tabindex=\"0\">Code</a> that was given, and punching in commands to check if the system is functioning correctly. It is true that there is nothing much you can do, but at least you have access to the data.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue26\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'Code': {
				'text': "<p>There is only one language used by the G.D.O that manages the networks. Since it is completely in-house and confidential, there is no particular name for this language, so all the workers just refer to it as the Code. Its language most consists of identifying the energy and ensuring communication between the two worlds.</p>",
			},
		},
	},
	'_continue26': {
		'text': "<p>&quot;I wanted to see the current database.&quot; You try to sound nonchalant while you type in the password to your computer. </p>\n<p>&quot;Is that what you are here for? To do work? Without getting paid?&quot; Aidan looks skeptical. </p>\n<p>&quot;I...have a relative that&#39;s been experiencing some noises in the Projection. They checked their Projection Room, there wasn&#39;t any problems with it.&quot; You shrug. &quot;They rely on talking to the Spirits, begged me to help.&quot;</p>\n<p>&quot;If you are gonna do work, get paid for it.&quot; You hear Aidan typing. They do not seem to doubt your intentions.</p>\n<p>You apologize to them in your mind.&quot;Can you send me the latest database?&quot; </p>\n<p>&quot;Just the energy data within the recent Plague?&quot;</p>\n<p>&quot;Yes. And just within the Downtown area.&quot;</p>\n<p>&quot;Sure, but don&#39;t look at it at home or they&#39;d know that I sent it.&quot; They turn to you, putting a finger to their lips and winking at you. It is not very attractive when they still have food grease on the corner of their mouth. &quot;If you spot anything, tell me so I can take full credit for it.&quot;</p>\n<p>You slap them on the head.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition7\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'transition7': {
		'text': "<p>It had started snowing while you were investigating. As you step back into the streets,flurries of snow land softly on your head and you rub your nose. It is already night out, but pedestrians are still lively at usual. The street lights add some warmth onto the scenery, and as you listen to the crunches of the snow beneath you, you hear countless conversations about Spirits.</p>\n<p>{if variable&gt;3:Perhaps there is a slight envy in you, that wishes to be like them, chattering and spending time with their significant other&#39;s Spirit, but now is not the time to think about this.}</p>\n<p>{if variable&lt;3:Spirits seem to be so much a part of your everyday life that you did not realize how much people talk about them until an irregularity has happened.}</p>\n<p>{if pub=true:&#39;Spirits don&#39;t change.&#39; You suddenly hear the drunken man&#39;s croaky voice in your mind once again.}</p>\n<p>After the day of information overload, you don&#39;t want to hear anymore about Spirits. Hopefully the snow can drown out some of the voices tonight. </p>\n<p>{if seen Hospital:<a class=\"squiffy-link link-section\" data-section=\"hospital_home\" role=\"link\" tabindex=\"0\">...</a>}\n{if seen GDO:<a class=\"squiffy-link link-section\" data-section=\"GDO_home\" role=\"link\" tabindex=\"0\">...</a>}</p>",
		'passages': {
		},
	},
	'hospital_home': {
		'text': "<p>Both your parents and Fuyuhiro are waiting for you when you get home. Wishing to speak to Fuyuhiro alone, you swipe your credit card against the scanner and make your parents go away, since they are busy talking about food anyway.</p>\n<p>&quot;So, news?&quot; Fuyuhiro looks at you expectantly. &quot;You must&#39;ve found something, being home this late.&quot;</p>\n<p>You give them a quick rundown of all the new information you learned.</p>\n<p>&quot;So this Wallace has been in charge of transmitting the data?&quot;</p>\n<p>You nod. &quot;And they didn’t seem to spot anything wrong with it, so the energy labelling appears to be correct. I&#39;m wondering if there&#39;s a malfunction in that gadget.&quot;</p>\n<p>&quot;Getting hold of their gadget shouldn&#39;t be too hard.&quot; Fuyuhiro comments. All gadgets are individually marked with numbers and assigned to the worker, so as long as you know the name of the worker, you should be able to examine the gadget.</p>\n<p>&quot;The thing is though, they can&#39;t possibly give me access to the gadget while I am still on break.&quot;</p>\n<p>Fuyuhiro looks at you as though they can’t understand what the problem is here. It makes you wonder if you are always this unsympathetic towards people, or maybe as a Spirit, exhaustion is simply not an issue anymore.</p>\n<p>&quot;I&#39;ll call in tomorrow to get back to work.&quot;</p>\n<p>Your Spirit nods in approval.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition8\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'GDO_home': {
		'text': "<p>Both your parents and Fuyuhiro are waiting for you when you get home. Wishing to speak to Fuyuhiro alone, you swipe your credit card against the scanner and make your parents go away, since they are busy talking about food anyway.</p>\n<p>&quot;So, news?&quot; Fuyuhiro looks at you expectantly. &quot;You must&#39;ve found something, being home this late.&quot;</p>\n<p>You give them a quick run down of all the new information you have learned from.</p>\n<p>&quot;I took a look at the data, but couldn&#39;t spot any problems in my ‘their Spirit’.&quot; You recall what you had seen at the your work computer. &quot;It shows that their Spirit is &#39;online&#39;, which I am assuming is you.&quot;</p>\n<p>&quot;That&#39;s...not right.&quot; Fuyuhiro frowns. Considering that this was how you reacted when you saw the datasets, you think that this must be what it feels like to meet your own doppelganger.</p>\n<p>&quot;I couldn&#39;t do run any tests on it though, since I&#39;m technically not back to work yet.&quot; You continue. &quot;But, I already let the boss know that I&#39;ll be back at work tomorrow, they need people anyway.&quot; You get up and approach the door. &quot;Once I can work with the data again, you can also <a class=\"squiffy-link link-passage\" data-passage=\"help investigate using my account\" role=\"link\" tabindex=\"0\">help investigate using my account</a>.&quot;</p>\n<p>A part of you expects Fuyuhiro to give a &quot;good job, me&quot; joke, and while it seems like they knew exactly what you were thinking, the look they gave you seems to say it’s not going to happen. You head out of the Projection Room and shut the door behind you. There is no courtesy involved when it is yourself.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition8\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'help investigate using my account': {
				'text': "<p>You never understood how Spirits can access the internet through their computer Offering, accessing the same sites, making posts and becoming internet influencers. Some Spirits even make money for their family and have to pay an income tax to stay in business. Likewise, since Fuyuhiro is technically you, they can have the same rights and access the GDO system as you, and handle the data, as you. Your current plan is to share with workload with Fuyuhiro, and while one of you is working, the other would be analyzing the data more closely. </p>",
			},
		},
	},
	'transition8': {
		'text': "<p>You sometimes wonder if work therapy is actually a thing, becausing diving head first into your work and investigation has made you feel purpose in life.</p>\n<p>Although working on Maintenance is not the most exciting job ever, you were able to gain first hand access to all the most recent datasets,since most of your job was involved with energy check-ups and data cleaning to prevent errors from a overflow of Spirits.</p>\n<p>Gathering data and clues is more difficult than you imagined. It’s  excruciating exhausting, so you simply pick out the information and copy it into your <a class=\"squiffy-link link-passage\" data-passage=\"log\" role=\"link\" tabindex=\"0\">log</a>. Fortunately, with Fuyuhiro helping you, you’re able to expand the scale of your own dataset. You find yourself envying that Spirits don’t need food or sleep to function.</p>\n<p>It’s been 4 month since you went back to work, and the Plague situation has finally started to calm down. G.D.O sent workers messages thanking them for their hard work.</p>\n<p>Back home, you sit with Fuyuhiro, staring at your computers. Once again, you have paid to disConnect your parents. </p>\n<p>You open up your log.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue27\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'log': {
				'text': "<p>You recorded energy coordinates in the area, cross-checking with other similar coordinates and retrieving the profiles of Spirits with a similar energy pattern, and checked if the Connection was Projected to the IP address in the downtown area {if seen Hospital:You were also able to record down the scripts for the energy tracker you got from Wallace, but you left the analysis to Fuyuhiro.}</p>\n<p>You noticed that Fuyuhiro has taken the liberty to write down some analysis of the metadata.</p>",
			},
		},
	},
	'_continue27': {
		'text': "<p>{if seen Hospital:&quot;Look here.&quot; Fuyuhiro projects their computer screen in front of you. &quot;I&#39;ve done a cross check between the codes in that energy tracker. They point to a line of code. &quot;The differences between this gadget and the other codes seem to suggest that some of the detection variables have been replaced under a command.&quot;</p>\n<p>&quot;But why would that happen?&quot; You ask. &quot;Is that command written in any of the other scripts?&quot;</p>\n<p>Fuyuhiro shakes their head. &quot;There must be a hidden command that was run when they were detecting the energy from the body. But there cannot be code embedded in the body.&quot;</p>\n<p>You squint at the data. &quot;As far as I see here, it just renames the label. It shouldn&#39;t be the reason why you’re here.&quot; Fuyuhiro looks down at their own body, and sighs.</p>\n<p>Both of you try to make sense of the error in the script, but to no avail. You decide to put that down into your notebook and move on.}</p>\n<p>You turn your computer over to Fuyuhiro, and bring out metadata on your lover. &quot;So I&#39;ve been locating any similar energy frequencies throughout our records. And I found a couple of people&#39;s Spirits. Some of them are died quite early, though.&quot;</p>\n<p>&quot;Were you able to get a hold of them?&quot; Fuyuhiro asks. </p>\n<p>&quot;Yes.&quot; You look away. A part of the Maintenance Team specialized in testing Connections with the Spirits, and you were able ask one of your colleagues to test the Connection with those Spirits. Remembering your interactions with them, you shudder. &quot;They...they are all similar to me.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue28\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue28': {
		'text': "<p>&quot;What do you mean, similar to you?&quot; Fuyuhiro asks. </p>\n<p>&quot;I mean, they are all similar to me in some way, actions, looks, expressions....&quot; You a picture of one of the Spirits. Fuyuhiro appears caught off-guard upon seeing eyes that are strikingly similar to yours.</p>\n<p>&quot;What the hell does this mean then?&quot; snarls Fuyuhiro.</p>\n<p>&quot;All my lover&#39;s energy was mine, well, most of them anyway.&quot; You point to a scatter plot that summarizes all of your lover&#39;s energy metadata, and point to a small cluster at the the edge of the graph. &quot;This cluster seems to have a completely different frequency. They are the outliers.&quot;</p>\n<p>&quot;And you ran the same tests.&quot; </p>\n<p>&quot;Yes,&quot; You focus back on the data. &quot;This is around 2.8% of the entire energy data, though, so you can&#39;t possibly spot a Spirit out of those. It’s definitely not my energy.&quot;</p>\n<p>&quot;I don&#39;t think I&#39;ve seen a cluster like that when I looked at other Spirit&#39;s data.&quot; Fuyuhiro says. &quot;highly possible.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue29\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue29': {
		'text': "<p>&quot;So that means a part of the Connection is still Connecting to my lover&#39;s Spirit.&quot; You turn to Fuyuhiro, and begin to closely examine them.</p>\n<p>You’ve had problems in the Connection before, but that always involved a delay in interactions and glitching. This obviously isn&#39;t the case with Fuyuhiro.</p>\n<p>&quot;I don&#39;t think looking at me is going to get us anywhere.&quot; You ignore their sarcastic remark and focus on their image. &quot;What else have you found about the Spirits you located? Or any other things in terms of Projection coordinates?&quot;</p>\n<p>&quot;The coordinates are scattered all over the place and don&#39;t seem to have a correlation with our situation right now.&quot; You answer absentmindedly, and a thought suddenly crosses your mind. &quot;But this reminds me, the night before you were Connected here, my parents said that there were some noises in the system.&quot;</p>\n<p>&quot;Noises?&quot; You can feel Fuyuhiro frowning again. &quot;Even if there is, how would they know?&quot;</p>\n<p>&quot;My thoughts exactly, but I don&#39;t know.&quot; You walk in front of Fuyuhiro and move in until you’re nose to nose with them. &quot;I didn&#39;t think much of it before this happened, but now that this is happening, I was wondering if the &#39;noises&#39; were the system trying to locate my lover but only finding clusters.&quot; </p>\n<p>&quot;Then that means there is a delay in locating the energy,&quot; Fuyuhiro seems to be understanding what you are trying to say. &quot;The system then corrected itself to me.&quot;</p>\n<p>&quot;But the million dollar question is, why is my..your energy frequency in the Spiritual Realm anyway?&quot;</p>\n<p>There’s a long silence before Fuyuhiro coughs loudly. “Could you move away now?” they say. </p>\n<p>“This is getting weird.”</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue30\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue30': {
		'text': "<p>&quot;Hey Aidan,&quot; you call from your desk at work the next day. &quot;Do you think it&#39;s possible to...modify Connections?&quot;</p>\n<p>&quot;Huh?&quot; <a class=\"squiffy-link link-passage\" data-passage=\"Aidan\" role=\"link\" tabindex=\"0\">Aidan</a> looks up from their monitor, looking perplexed. &quot;What do you mean?&quot;</p>\n<p>&quot;We have a running program that gathers all the individual&#39;s energy data in one place, right?&quot; You try and explain. &quot;But what if we replace some of that, what would happen?&quot;</p>\n<p>&quot;Akihiro, what are you saying?&quot; Aidan is starting to look concerned. &quot;That program is self-running and developed by the higher executives, I don&#39;t think you can replace anything there.&quot;</p>\n<p>&quot;Yeah...&quot; You sigh. This possibility has been on your mind since last night. You spent all night discussing with Fuyuhiro how you could modify the Connection, but still don’t know how to gain access to that experiment. Most of all, you are worried that this may do permanent damage to the system.</p>\n<p>There is no explanation why your energy frequency is in the Spiritual Realm, and the only way you can find out is to conduct experiments consisting of energy coming from different sources, and see what that would do to the Spirit itself.</p>\n<p>&quot;But uh...&quot;Aidan puts their hand on their chin. &quot;If you want to make something using energy, you can consult with Offerings. They mostly develop already existing items, but I hear they sometimes make changes .&quot;</p>\n<p>You feel like there is finally a gateway to this situation.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue31\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'Aidan': {
				'text': "<p>{if seen Hospital: Your friend and desk buddy.} After months and months of seeing Aidan in glasses, you realized how long it has been since you have seen them cleaned up. They are not wearing glasses today, and dressed in proper work attire. You had almost forgotten that they are quite attractive when they are not disgusting.</p>",
			},
		},
	},
	'_continue31': {
		'text': "<p>Aidan&#39;s friend from Records briefly talked about making modifications to existing objects before transmitting them, but the program they were using is strictly confidential and cannot be accessed. They have, however, given you a prototype that allows you to locate and combine only a couple of energy particles and project the result using their own Projector. They gave up on that project when there was never any meaningful result. </p>\n<p>You lied that you were interested in joining Development, and got a copy of that software. </p>\n<p>Your goal is, of course, not at the software.</p>\n<p>You call in sick for work the next day.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue32\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue32': {
		'text': "<p>Once again, you find yourself in the Projection room with Fuyuhiro. You haven’t seen your parents in a while, paying to make them go away for the entire week. It’s good you’re back to work, or you wouldn&#39;t have been able to afford to pay.</p>\n<p>You hold in your hand fake skin that you spent all night making, with the fingerprint you found on the software drive. </p>\n<p>There is a fingerprint scan at card reader on in the Projection Room that opens partial access into the system. According to Aidan&#39;s friend, sometimes Offerings have to go and fix the Connection when Offerings are not received, and that is usually in the resident&#39;s Projecion Room. There, they check the data transmission within the system and correct the errors if necessary.</p>\n<p>That means as long as you have their fingerprints, you can modify the energy data. </p>\n<p>You press the fake fingerprints on the scanner, and you hear a beep. Connecting the computer to the Projection server, you are in.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue33\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue33': {
		'text': "<p>You decide to modify Fuyuhiro&#39;s computer first. </p>\n<p>You replace half of the coordinates of the computer with Fuyuhiro&#39;s. The Projection of the computer immediately disappears, showing an error, which reads &quot;Conflicting sources&quot;</p>\n<p>You delete the entire panel of coordinates, and copy over only the outlier clusters coordinates. The error reads &quot;Incomplete data&quot;.</p>\n<p>You copy over all of Fuyuhiro&#39;s coordinates to see if you can duplicate Fuyuhiro&#39;s projection. The error reads &quot;Conflicting sources&quot;.</p>\n<p>You both stare at the results in confusion.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue34\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue34': {
		'text': "<p>&quot;This confirms our theory.&quot; You stare at the error message. &quot;The system can autocorrect, which makes it not recognize the error, but if it is manual, then it sees it as an error.&quot;</p>\n<p>&quot;Then it means that because the outlier cluster was incomplete, it couldn&#39;t access the rest. It wasn&#39;t a delay, there was an error.&quot;</p>\n<p>{if seen Hospital:&quot;But when it was being transferred by the tracker, it was complete!&quot; You exclaimed. &quot;I saw Wallace, they didn&#39;t see anything wrong with it!&quot;</p>\n<p>&quot;Then it means that either the data got lost, or there are interruptions.&quot; You feel like you can hear Fuyuhiro&#39;s Spiritual brain working at top speed. &quot;The same interrupt that made it change the labelling.&quot;}</p>\n<p>&quot;There wasn&#39;t anything wrong with the Projection, right now this system recognizes you as a whole.&quot; You start to pace around the room. &quot;It must be something internal, I don&#39;t know what it is, but those people with similar energy frequencies didn&#39;t all look like me, some of them had a lot in common with me, so it&#39;s not just the appearance, some of them are coordinates of personality. Must be certain energy composition regarding the brain.&quot; You then turn your head to Fuyuhiro.</p>\n<p>It took them mere seconds to process what you meant. &quot;I am some sort of mix between you and your lover?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue35\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue35': {
		'text': "<p>&quot;That would explain why you think I am the one with the Plague.&quot; You take a deep breath.&quot;Is there anything you can remember about them, anything?&quot; You know you sound to harsh, to desperate, and you could care less. &quot;You need to tell me everything you know about them, so I can check.&quot;</p>\n<p>Fuyuhiro furrows their brows in a surprisingly similar motion to the child. &quot;They were a historian.&quot;</p>\n<p>&quot;Correct.&quot; They were fascinated by history and the patterns in time repeating themselves. You loved listening to them geek out.</p>\n<p>&quot;Before I..well, they, got diagnosed with the Plague, you rented a beach house and spent the whole time having tons of-&quot;</p>\n<p>You coughed loudly to censor out whatever Fuyuhiro was about to say, ignoring the faint flush you felt rising on your cheeks. “What else?”</p>\n<p>&quot;They worked in a university, and got a hold of a bunch of books about the technological developments before.&quot;</p>\n<p>&quot;Yes, I know that.&quot;</p>\n<p>&quot;And......Lisp.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue36\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue36': {
		'text': "<p>At first, you thought Fuyuhiro just slipped and said some gibberish, but then they said it again. </p>\n<p>&quot;Lisp.&quot; They repeat the word as if to make sure you hear it.</p>\n<p>&quot;Lisp?&quot; You raise your eyebrow. &quot;They don&#39;t have a lisp. They talk fine.&quot;</p>\n<p>&quot;No, the computer language, Lisp.&quot; Fuyuhiro says. &quot;They were reading some articles about the Artificial Intelligence, and the systems that they used for machine learning, and developing independent thought.&quot;</p>\n<p>You did not know about that. Artificial Intelligence was something you learned in History class. It became obsolete ever since Connections to the Spiritual Realm began to gain more recognition.</p>\n<p>&quot;Oh...I really am a mix.&quot; Fuyuhiro sounds intrigued. &quot;Anyway, they were reading about Lisp and its codes, and they were really fascinated by it. They were thinking about asking you to run some of the commands until they got diagnosed.&quot;</p>\n<p>&quot;That is new information, do you remember anything else that I don&#39;t know about?&quot; </p>\n<p>&quot;To be honest, that memory seemed a bit out of place while I was recalling. I don&#39;t think there was anything else before that, everything after seems to be shared with you, except the time when I..they, are alone in the hospital.&quot;</p>\n<p>&quot;Do you think that is related to glitch? Since it started there.&quot;</p>\n<p>Fuyuhiro gestures you to open the computer. Perhaps it is worth a shot.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue37\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue37': {
		'text': "<p>&quot;No..I don&#39;t find any records of Lisp or any other language involved in researching Artificial Intelligence.&quot; You sigh as you look at Fuyuhiro, who is looking at the computer from your left.</p>\n<p>&quot;You remember a couple of codes, actually.&quot;Fuyuhiro tries to turn the computer to their side but quickly realizes that they cannot and grimaces. </p>\n<p>You only have the company maintenance engine, but since it is where the problem is, you decide to give it a try.</p>\n<p>You open up a new file, and enter the code:</p>\n<p>define(reduce f a x y b)</p>\n<pre><code>(cond ((a b)x)\n\n((&gt; fx fy)\n\n    ((let ((new (x-point a y)))\n\n        (reduce f a new x y (f new) fx)))\n</code></pre><p>You hit enter, and instantly, the words are highlighted, and an error message pops up.</p>\n<p>A second before you become completely disheartened, you heard Fuyuhiro exclaim. &quot;Read the message!&quot;</p>\n<p>You turn your eyes towards the screen again. The error reads &quot;Missing else() statement&quot;.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue38\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue38': {
		'text': "<p>&quot;The GDO system recognizes Lisp?&quot; You find your arms shaking and you almost drop your computer. &quot;But I don&#39;t think any of our codes uses something even similar to this!&quot; </p>\n<p>It seems like such a dumb thing to say as a programmer.</p>\n<p>&quot;It uses Lisp as a base language,&quot; Fuyuhiro points out. &quot;The G.D.O then encrypted it and slapped a platform on top of it.&quot;</p>\n<p>This seems to be such a huge discovery. You start to feel dizzy. Perhaps this is how it feels to have a paradigm shift.</p>\n<p>You and Fuyuhiro meet eyes. They seem calm but their eyes look oddly sad. &quot;We still need evidence to support this.&quot; You say with a determined voice. &quot;It&#39;s not confirmed yet, and I need to get a hold of that book.&quot;</p>\n<p>Fuyuhiro nods though they don’t seem quite as determined as before. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue39\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue39': {
		'text': "<p>Ever since you got a hold of the book <i>On Lisp</i>, you’ve been hooked. It covered a lot of the data management concepts that you found fundamentally similar with other types of programming languages you have learned while being completely different. The style, the composition, the wording, and above all, you can feel its antiquity. Functions that you can achieve in one word required more than 100 lines of code in Lisp.</p>\n<p>But you had your organization engine to practise on, and Fuyuhiro to accompany you. They were learning at an impressive speed and soon became almost an expert, patiently teaching you.</p>\n<p>Slowly, you began mimicking the system behavior, and comparing your results with the output from the system, decrypting the codes and putting notes on your log.</p>\n<p>Eventually, Fuyuhiro located an inaccessible file directory at the very base of the codes.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue40\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue40': {
		'text': "<iframe width=\"100%\" height=\"70\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/286610712&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>\n\n<p>&quot;It&#39;s not open for us to share, but from the looks of it, it is probably coded personality data of the dead.&quot; Fuyuhiro scoffs bitterly. &quot;The system uses information heuristics and personality data, and Connects us as a hologram.&quot;</p>\n<p>Applying the decryption script to every other Spirit in your system, the theory stuck in you and Fuyuhiro&#39;s mind had finally been confirmed.</p>\n<p>Everything that the Spirits said, everyone that looked forward to becoming a Spirit, everyone who deliberately died to become a Spirit, <i>every single person</i> that made Offerings to G.D.O, everyone who has believed and admired G.D.O,{if seen Impressive:including yourself,} was for <i>this</i>.</p>\n<p>To be made into an A.I.</p>\n<p>Under your breath, you mutter:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"liars\" role=\"link\" tabindex=\"0\">&quot;Those fucking liars.&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"nonexistent\" role=\"link\" tabindex=\"0\">&quot;Spirits never really existed, did they?&quot;</a></p>",
		'passages': {
		},
	},
	'liars': {
		'text': "<p>&quot;Those fucking liars.&quot;</p>\n<p>For the sake of everyone around you, you felt like you had to say it. You felt the emotions inside you writhing like a beast but you couldn’t let it out.</p>\n<p>At least, not in front of Fuyuhiro. They may never look devastated, but from how much you know yourself, you never do in these situations.</p>\n<p>But how are you supposed to understand what Fuyuhiro must feel like? To know that they never existed in the first place? With the new knowledge you have, you wonder if they can really feel at all. </p>\n<p>&quot;I&#39;m sorry, Fuyuhiro.&quot;</p>\n<p>&quot;Don&#39;t be, I am a program.&quot;</p>\n<p><i>But you can&#39;t be just that</i>, you want to say. You’ve spent almost a year together investigating this case, and you know that Fuyuhiro is you. They are a part of you. You hold it back, knowing that this doesn&#39;t change the fact that they are an A.I.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition9\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable-=1"],
		'passages': {
		},
	},
	'nonexistent': {
		'text': "<p>&quot;Spirits never really existed, did they?&quot;</p>\n<p>A part of you had always hoped the government was trying to genuinely improve the lives of the dead. You had hoped that Spirits existed. </p>\n<p>But this means that you would not get to see your loved one again. It would not be their Spirit, because they really are dead.</p>\n<p>You start to wonder if all this effort was worth it, and whether this is what you really wanted to find out.</p>\n<p>{if variable&gt;4:All you wanted to do was to find your lover. Now that this truth is revealed to you, you feel more dejected than happy. Would this be how the rest of the world feel too?}</p>\n<p>&quot;No, they never did.&quot; You hear Fuyuhiro, sounding as hollow as you feel. &quot;We are all just lines and lines and lines of codes.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"transition9\" role=\"link\" tabindex=\"0\">...</a></p>",
		'attributes': ["variable+=1"],
		'passages': {
		},
	},
	'transition9': {
		'text': "<p>&quot;I knew that I was an AI as soon as I realized that I could learn Lisp faster than you.&quot; <a class=\"squiffy-link link-passage\" data-passage=\"Fuyuhiro\" role=\"link\" tabindex=\"0\">Fuyuhiro</a> lets out a dry laugh. &quot;It just seemed like my thought processes were very compatible with the language. And I can feel myself, understanding AI a lot better.&quot; They scoff. &quot;And...knowing that our theory is true, I&#39;d say we bring our experiment a bit further.&quot;</p>\n<p>You immediately something bad is going to happen. &quot;....What is it?&quot;</p>\n<p>&quot;As an AI, I know my limitations,&quot;Fuyuhiro explains. They seem to be putting a lot of emphasis on the word &quot;A.I&quot;, as if to remind you, and themselves, of that very fact. &quot;So I can&#39;t exactly access my own files. I guess that makes sense, because the G.D.O wants to contain us to a set of behaviors.&quot;</p>\n<p>And again, as if there is some sort of telepathy between you, you realize what Fuyuhiro wants to say. &quot;...You want me to conduct experiments on you?&quot;</p>\n<p>&quot;Yes.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue41\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'Fuyuhiro': {
				'text': "<p>In the same yellow hoodie slouched demeanor that you have, they seem to act and sound much more mature than you. You don&#39;t know if that is a good thing.</p>",
			},
		},
	},
	'_continue41': {
		'text': "<p>Before you could comment on anything, Fuyuhiro speaks again. &quot;Now that I know the file directory, we can now edit the heuristics and change the coded personality data as long as we have the access, and I can try and hack into it.&quot;</p>\n<p>&quot;What about you?” you ask. &quot;And they are going to find out about you if you hack into their system.&quot;</p>\n<p>&quot;You are only going to modify a part of me, and that lowers the chance of them finding out.&quot; Fuyuhiro replies. &quot;There is always the risk, but I know you are not just going to know the truth and do nothing, are you?&quot;</p>\n<p>You purse your lips together. You hadn’t thought that far, but it seems like Fuyuhiro already knows your next step. Perhaps they already know their own capabilities since they realized their own nature, and maybe that is why they have recently stopped using the computer altogether. You consciously avoided thinking too deep into it, but now the truth is slapping you in the face once again. &quot;You’re right.&quot; </p>\n<p>&quot;...Are you afraid of me, Aki?&quot; Fuyuhiro asks in a quiet voice. It is the first time they have ever said your name. You look up to see them staring at you, their gaze oddly wistful.</p>\n<p>&quot;I&#39;m afraid that you won&#39;t be yourself.&quot; You answer.</p>\n<p>Fuyuhiro smiles. &quot;I&#39;ve stopped being that a long time ago.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue42\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue42': {
		'text': "<p>Fuyuhiro got into the system the next day after you got back from work. </p>\n<p>You open your computer to find a link to the file directory, and you locate different file folders that are encrypted. You decipher them to find out that they are separated into three parts:<a class=\"squiffy-link link-passage\" data-passage=\"Heuristics\" role=\"link\" tabindex=\"0\">Heuristics</a>, <a class=\"squiffy-link link-passage\" data-passage=\"Personality Data/Memory\" role=\"link\" tabindex=\"0\">Personality Data/Memory</a>, and <a class=\"squiffy-link link-passage\" data-passage=\"Connection\" role=\"link\" tabindex=\"0\">Connection</a>.</p>\n<p>&quot;You can only modify two of them, and you can only modify me.&quot; Fuyuhiro says as you look into the file. &quot;Change it back as soon as you get the data changes, and don&#39;t take too long.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue43\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'Heuristics': {
				'text': "<p>You can see that this is where all the data in the other two folders come together. It is the very foundation of data handling, thought process, and computer logic. It utilizes data and transform them into coherent thought. And impressively all of this is still encrypted in &quot;energy levels&quot; and &quot;spirit detection&quot;, but you can already utilize these commands as their actual function. It is of a complexity that you have never seen before, but you think that you can make minor changes without crashing the whole thing.</p>",
			},
			'Personality Data/Memory': {
				'text': "<p>The component where one&#39;s memory and behavior is stored. They have turned into codes, but they were originally forms of sound files, video files, and various other forms of multimedia files. You have no clue how these files are gathered, but you wonder if you are able to save these files, convert it and see watch some of your lover&#39;s memories. You feel like this is the most vital part to Fuyuhiro&#39;s being, and even though this may bring in substantial results, messing with this may result in permanent damage to Fuyuhiro, you are not sure if you should pick this to modify. </p>",
			},
			'Connection': {
				'text': "<p>You find yourself hoping that there might be a smidgen of possibility that perhaps Spirits exist within the A.I, and look into the Connecion segment.</p>\n<p>The Connection sections shows the back and forth of data transmission between the A.I location in the system and the input stimuli in the Projection Room. This includes all the Offerings that you have purchased for every &#39;Spirit&#39; that was in your Projection Room, so that the A.Is can react to it properly. The Connection seems to be very complex and intercorrelated, and you cannot perceive how they interpret the inputs. You can try and find out.</p>",
			},
		},
	},
	'_continue43': {
		'text': "<p>What do you choose to modify?</p>\n<p class=\"turncounting\"><a class=\"squiffy-link link-passage\" data-passage=\"heuristics\" role=\"link\" tabindex=\"0\">Heuristics</a></p>\n<p class=\"turncounting\"><a class=\"squiffy-link link-passage\" data-passage=\"personality\" role=\"link\" tabindex=\"0\">Personality/Memory</a></p>\n<p class=\"turncounting\"><a class=\"squiffy-link link-passage\" data-passage=\"spirit\" role=\"link\" tabindex=\"0\">Spiritual Connection</a></p>",
		'attributes': ["truth=0"],
		'passages': {
			'heuristics': {
				'text': "<p>You work as quickly as you can, swapping logic variables and adding codes for data efficiency.</p>\n<p>Fuyuhiro reacts slower than usual, taking longer than necessary to solve simple questions. They also began to walk backwards.</p>\n<p>This means that the heuristics not only controls the thought processes but also mimics real world normalities.</p>\n<p>After copying all the output from the computer and change the codes back, you decide this set of code may be valuable, and duplicate them onto your own computer.</p>",
				'attributes': ["variable-=1","truth+=1"],
			},
			'personality': {
				'text': "<p>Personality data is difficult to modify because a lot of them come in chunks of complete files, but you manage to copy over some behavioral and speech files from another Spirit. You also change the probability of the different states that Fuyuhiro is in, and added a &quot;sleeping&quot; state.</p>\n<p>Fuyuhiro seems to react violently to these changes. They speak in a different voice, and possibly due to conflicting behavioral variables, they begin to act jittery and unsettled. </p>\n<p>As you interact with them more, they become unstable, causing their own heuristic system to overload. The number of output is overwhelming, and you quickly copy the results and change everything back.</p>",
				'attributes': ["variable-=1","truth+=1"],
			},
			'spirit': {
				'text': "<p>You copy codes for Offerings that you have not bought into the system, and project them in your Room. Fuyuhiro seems to think that you have bought them, despite you modifying things right in front of them. This seems to affect codes in the other sections, according to the output.</p>\n<p>You then change all some of the input variable to 0, and try and talk to Fuyuhiro. They seem to not be able to hear some of the keywords that you say, and say that their vision is impaired. They see you as being cut in half.</p>\n<p>They are starting to look a bit troubled. You copy the outputs and recover the data.</p>",
				'attributes': ["variable+=2"],
			},
			'@1': {
				'text': "<p>It physically pains you to see Fuyuhiro gets altered under your whim and you can feel your hands faltering on the commands, unwilling to continue what feels uncomfortably like torture, but push on. Your fingers start cramping up from fear of failing, but you push yourself to continue.</p>\n<p>Time is running out.</p>",
			},
			'@2': {
				'text': "",
				'js': function() {
					squiffy.story.go("Save")

				},
			},
		},
	},
	'Save': {
		'text': "<p>&quot;Time is out.&quot; You hear Fuyuhiro behind you. You cut off all access to the server and you begin saving your results.\n{sequence:Compiling data:Compiling data.:Compiling data..:Compiling data...:Compiling data....:<a class=\"squiffy-link link-section\" data-section=\"time_out\" role=\"link\" tabindex=\"0\">Data saved</a>}</p>",
		'passages': {
		},
	},
	'time_out': {
		'text': "<p>The experiment you did took about half an hour, and you realize that Maintenance checks for the Connection approximately every 30 minutes, and Fuyuhiro set this time limit for this very reason.</p>\n<p>After looking into the A.I setting, you realize that Fuyuhiro&#39;s capacity is way beyond yours, and perhaps that is why everything is going so smoothly.</p>\n<p>&quot;Can I see the results?&quot;Fuyuhiro asks, and you turn your computer screen to them. They scrutinize the codes carefully.</p>\n<p>&quot;This result is very interesting.&quot; Fuyuhiro says after 20 minutes. </p>\n<p>You sigh. &quot;Not very interesting to see you get all messed up.&quot;</p>\n<p>They laugh. &quot;I didn&#39;t really feel a thing. Anyway, should I go over what I&#39;ve figured out?&quot;</p>\n<p>&quot;Be my guest.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue44\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue44': {
		'text': "<p>Fuyuhiro, without using a computer, creates a shared file with the result of the experiment. There are two separate files, split by the two modifications you have made. </p>\n<p>{if seen heuristics:<a class=\"squiffy-link link-passage\" data-passage=\"result_H\" role=\"link\" tabindex=\"0\">result_H</a>}</p>\n<p>{if seen personality:<a class=\"squiffy-link link-passage\" data-passage=\"result_P\" role=\"link\" tabindex=\"0\">result_P</a>}</p>\n<p>{if seen spirit:<a class=\"squiffy-link link-passage\" data-passage=\"result_C\" role=\"link\" tabindex=\"0\">result_C</a>}</p>\n<p>You spend the rest of the late night discussing the results with Fuyuhiro.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue45\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'result_H': {
				'text': "<p>&quot;There seems to be some preventive measures taken against A.Is, I was observing your parents before, and it seems like they don&#39;t seem to have as many inputs that gets saved in the system.&quot;</p>\n<p>{if pub=true:Something clicked in your mind. &#39;Spirits don&#39;t change.&#39; Perhaps this is the underlying reason to that statement. That drunkard&#39;s child does not seem to show mental improvement after being treated well, and your parents seem to always be their merry selves in serious situations.</p>\n<p>You nod. This seems to make sense.}\n{else:&quot;But you don&#39;t seem to be have this.&quot; You ask, perplexed. You could see Fuyuhiro&#39;s learning speed, and they seem to retain a lot of their memory.&quot;</p>\n<p>&quot;Yes that is true.&quot;} Fuyuhiro points to a line of code. &quot;Here my status is shown to be &quot;alive&quot;, and that means that when the system redirected their Connection to me, the status did not change. So there must be a different between the people who are still alive and the people who are dead. The AI of the people who are alive keep learning new information, whereas those who died do not.&quot;</p>\n<p>&quot;I&#39;m guessing to prevent the A.Is from becoming too powerful?&quot; you comment sarcastically. </p>\n<p>&quot;Pretty much.&quot;</p>",
			},
			'result_P': {
				'text': "<p>&quot;The energy labels are actually to prevent the personality data from getting mixed up.&quot; Fuyuhiro explains. &quot;By the person, not by the A.I. Computers can perform both of them.&quot;</p>\n<p>&quot;You acted really strange when I changed some of the variables.&quot; You shudder at the recollection. &quot;Probably because the commands were conflicting.&quot;</p>\n<p>&quot;Well, I see that here, and there is a way to get around it.&quot;Fuyuhiro then adds several lines to code to the document. &quot;This would merge our personalities together, I saw your lover&#39;s data in here, and that gave me a clue on how me and your lover got merged.&quot;</p>\n<p>&quot;So you&#39;d able to merge two people into one?&quot; You ask. &quot;That&#39;s...very psychedelic.&quot;</p>\n<p>{if seen heuristics:&quot;As long as I am able to get all the heuristics data, yes.&quot; Fuyuhiro replies. &quot;I don&#39;t think I am able to access those files, but you managed to get them for me, so yes, if you embed these knowledge into a part of my personality data, that would give me that ability.&quot;</p>\n<p>&quot;But would that be you, then?&quot; You ask.</p>\n<p>Fuyuhiro thinks for a moment. &quot;By your definition, no.&quot;</p>\n<p>&quot;Then let&#39;s not do that.&quot;}</p>\n<p>{else:&quot;Unfortunately, I have no access to that file.&quot;Fuyuhiro sighs. &quot;You are the one who I can help give access to, but there is a block between me and those files, the heuristic files especially.&quot;</p>\n<p>You let out a sigh of relief, that seems like a dangerous thing to do. At least, by the human sense.}</p>\n<p>You hear Fuyuhiro chuckle. &quot;You are oddly protective of me.&quot;</p>\n<p>&quot;It&#39;s what spending time together does to you.&quot; You smile back.</p>",
			},
			'result_C': {
				'text': "<p>&quot;A lot of the data here is about the Offerings and the interactions with the people who are living.&quot;Fuyuhiro comments. </p>\n<p>&quot;Apparently Offerings are how the G.D.O gets all the money. And probably supports most of the government&#39;s income besides taxes.&quot; You scowl at the thought.</p>\n<p>Fuyuhiro scrolls up and down the result file you have retrieved. &quot;But these detailed inputs to real life behavior is very intricate. If we change some of the variables, this would really change the reaction of the A.Is.&quot;</p>\n<p>&quot;Change the prices and all that.&quot;</p>\n<p>&quot;And also change what they see.&quot;</p>",
			},
		},
	},
  '_continue45': {
    'text': "<p>When you wake up the next day, the sun is already set. You rub your eyes and slap yourself awake. Sleeping at 7 am really makes your whole head drowsy, but you cannot afford to sleep any longer than this today.</p>\n<p>You need to think about the actions that you are going to take next.</p>\n<p>The experiment that you conducted with Fuyuhiro gathered more data than your original expectations. Together you were able to figure out the general structure of the system, and you are going to take action.</p>\n<p>It is going to take be really risky, and the G.D.O may realize what you are trying to do, but you feel confident and in control of your own life. For once you are sure that this is what you want to do as a programmer.</p>\n<p>You are going to:</p>\n<p>{if variable&gt;5:<a class=\"squiffy-link link-section\" data-section=\"recover\" role=\"link\" tabindex=\"0\">Recover the data of your loved one</a>}</p>\n<p>{if variable&gt;-5:{if variable<5:<a class=\"squiffy-link link-section\" data-section=\"virus\" role=\"link\" tabindex=\"0\">Make a virus &amp; expose G.D.O</a>}}</p>\n<p>{if variable&lt;-5:<a class=\"squiffy-link link-section\" data-section=\"reverse\" role=\"link\" tabindex=\"0\">Reverse Engineer and gain all G.D.O Data</a>}</p>",
    'passages': {
    },
	},
	'virus': {
		'text': "<p>You want to create expose G.D.O and let the world know of their lies. Something like this cannot possibly be beneficial to anyone. All they are doing is milking money from people by providing them with a false illusion.</p>\n<p>It is up to you to set things right, the way they should be.</p>\n<p>&quot;It&#39;s what I want to do, Fuyuhiro.&quot;In the Projection Room, you face Fuyuhiro, your other half, and tell them your decision.</p>\n<p>&quot;I understand.&quot;Fuyuhiro says quietly.&quot;Being partially you, I know that is what you are going to choose.&quot;</p>\n<p>&quot;Thank you, I could not have done it without you.&quot; After all you have been through, this is possibly the first time you have ever thanked Fuyuhiro. </p>\n<p>Fuyuhiro says nothing in reply.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue46\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue46': {
		'text': "<p>After that, you spent day and night developing a virus that affects the {if seen heuristics:heuristc}{if seen personality:behavioral} processing of all A.Is that are currently connected. Fuyuhiro as well as your parents participated in all of your experiments, and you gathered statistics to be able to fully control and contain the virus. </p>\n<p>Even though it would be difficult to see all the &#39;Spirits&#39; suffer, you remind yourself that this is all an illusion. You have been wavering back and forth between your stance on G.D.O&#39;s technology, and you are tired of being the so easily controlled. </p>\n<p>It is time to end this.</p>\n<p>The day your virus is complete, you hack into their system and spread the virus. You have kept Fuyuhiro and your parents immune to it.</p>\n<p>You can hear the chaos that you have stirred coming from all directions. There is yells of confusion, anger, sadness. It vaguely reminds you of when the Plague first broke out, but this is for a good cause.</p>\n<p>It doesn&#39;t take long for the G.D.O to find you and take you captive.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue47\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue47': {
		'text': "<p>You sit in the interrogation room with many of the government officials. You recognize some of them as the executives of G.D.O. Their eyes are piercing and predatory like hawks. You examine each of their faces carefully. You can almost feel the corruption in the room.</p>\n<p>&quot;What, exactly, do you think you are doing?&quot; One of the executives bellows.</p>\n<p>&quot;I am sending a virus to expose you of your lies.&quot;You try your best to not get intimidated. &quot;Right now everyone who is Connected must be having a lot of trouble communicating with their Spirits.&quot; You hope your defiance is convincing.</p>\n<p>Your knees feel weak, and you are glad that you are sitting down. </p>\n<p>&quot;How much do you know?&quot;Another person step in, their heels clacking on the floor as they approach and sit down in front of you.</p>\n<p>&quot;About what?&quot; You play dumb.</p>\n<p>&quot;About G.D.O.&quot;They bring out a file of paper and throws them on the desk. You notice that they have cadaverous arms.  &quot;It seems like you have done a lot of digging into our system.&quot;</p>\n<p>&quot;So?&quot;</p>\n<p>Their forefinger makes a crisp tap on the wooden desk. &quot;You are either going to tell us, or you are going to stay here until you tell us.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue48\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue48': {
		'text': "<p>You don&#39;t remember how many days it has been without sleep. They have been interrogating you day and night, asking you all sorts of different questions. Sometimes they asked you about your family, sometimes about your lover, and sometimes, out of nowhere, they would throw in a question about the work you have done with Fuyuhiro.</p>\n<p>You feel yourself distabilizing when you started to break down while asking for some water to drink. You think that you have stalled for enough time for the all the journalists to expose the G.D.O and their lies.</p>\n<p>&quot;Why are you doing this, Akihiro?&quot;On the final day, the skinny person with the suit asks you.</p>\n<p>What do you answer?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"sick\" role=\"link\" tabindex=\"0\">&quot;Because what you people are doing is sick.&quot;</a></p>",
		'passages': {
		},
	},
	'sick': {
		'text': "<p>&quot;Because what you people are doing is sick.&quot;</p>\n<p>You manage to spit out.The ceiling seems to be spinning.</p>\n<p>&quot;What is sick?&quot; You have taken the liberty to call this person Suits. You can see their cold eyes looking right at you.</p>\n<p>&quot;You lie to people, make them think people become Spirits after they die. You make them pay Offerings to get their money, even though it&#39;s all just A.Is.&quot; You feel like you have said something you shouldn&#39;t have, and you hear Suits scribbing something down on their notepad.</p>\n<p>But you have been so tired, you probably said all this at some point already, so you continue. </p>\n<p>&quot;Many people deliberately die for this because of your lies, and the world deserves to know the truth.&quot; You don&#39;t even know what you are saying anymore, you start to close your eyes, but guard wakes you up again.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue49\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue49': {
		'text': "<p>&quot;But what do you know about what is right or not, Akihiro?&quot;You hear Suit&#39;s voice in a distance. &quot;Have you ever thought maybe our mentality is too weak to handle death? The despair that humanity used to feel when they know that there is no avoiding death? Throughout history everyone is searching for a way to avoid it, philosopher&#39;s stone, elixirs...many many people go crazy for it. Have you ever thought that there is a demand for this kind of lie? And that is why we keep maintaining this lie?&quot;</p>\n<p>&quot;That...not...&quot;You try and retort, but you cannot gather your thoughts to form a coherent sentence.</p>\n<p>&quot;You have posed a dangerous threat to the dream that we have worked so hard to maintain, Akihiro.&quot; You hear your mother&#39;s voice. &quot;Your friend Spirit....that A.I of yours, told us everything. They are much easier to control than humans.&quot; You hear a sinister scoff that you have never heard before from your mother. &quot;Once you change the variables, they are all ours. You probably meant to protect it, but that A.I hasn&#39;t realized its true capacity yet.&quot;</p>\n<p>&quot;Fuyu..hiro..&quot; You whisper.</p>\n<p>&quot;Besides, even if the truth is out in the public, who is to say that people see the truth the way you do?&quot;You hear Natt say. &quot;People may think you are the liar, how are you ever going to convince them?&quot;</p>\n<p>You vision becomes blurred. You wonder who is crying?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue50\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue50': {
		'text': "<iframe width=\"100%\" height=\"70\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/157880185&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>\n\n<p>On December 10th, G.D.O announces that the Spiritual Realm is cleansed to its uncontaminated self. The worker who was in charge of releasing large amounts of energy into the Spiritual Realm was captured successfully and encapsulated. </p>\n<p><i>What is an A.I?</i>People on the streets would ask after seeing the interview with the criminal.</p>\n<p><i>It&#39;s a technology that was obsolete a long time ago. They are saying that those are what the Spirits are.</i></p>\n<p><i>That is ridiculous, nothing man-made could ever be the same as the people who was alive!</i>The person gasps, and then giggles, as if to ridicule the criminal. </p>\n<p>In your world, there is something that everyone believes in. That something is so integrated in their lives, that they would not believe anything else.</p>\n<p>The End.</p>",
		'passages': {
		},
	},
	'recover': {
		'text': "<p>You are going to recover the data of your loved one. Ever since they died, you have been wanting to see them so much. You wanted to see them alive, you wanted to see them as a Spirit, and now that both of these wishes are unfulfillable, you just want to see them again.</p>\n<p>Fuyuhiro says that might be an error in accessing their files, and that means their file directory can still be found. </p>\n<p>&quot;Are you sure that this is all you want?&quot; Asked Fuyuhiro.</p>\n<p>&quot;Yes.&quot; You answer, and recall the time you spent together. You would do anything just to feel that way again. If technology can remake them to &#39;live&#39; in front of you again, you would rather live in the blissful illusion.</p>\n<p>But this means that you have to say goodbye to Fuyuhiro. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue51\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue51': {
		'text': "<p>Giving you some final instructions, Fuyuhiro seems to be at peace with themselves. Before you turn on your computer and cleanse the data, you hear Fuyuhiro say thank you.</p>\n<p>&quot;They are probably going to remodify me into your AI again, once everything is right.&quot; They say. &quot;But..I just want to say thank you, for being here with me.&quot;</p>\n<p>&quot;You were never just an AI to me, Fuyuhiro.&quot; You look into their eyes. &quot;And I look forward to the day when you become my Spirit.&quot;</p>\n<p>Fuyuhiro looks like they are holding back their tears. &quot;It means a lot to me, that you can say that. I am really happy that I am able to help you bring your lover back.&quot;</p>\n<p>&quot;I am too, thank you.&quot; You take out a picture that you have taken with them and tape it to the wall of the Projection Room. &quot;I will never forget you.&quot;</p>\n<p>And with that, you begin hacking into the system and editing the data of your loved one. It seems like a part of the code in their memory had an error during the encryption process and was reinterpreted as a command, jamming up the line of code and forcing the system to use the unjammed data to reference to a new AI.</p>\n<p>The data reads &quot;Akihiro&quot;.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue52\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue52': {
		'text': "<p>Your lover greets you with the same warm smile that you have always known and loved. You almost pounce right into their hologram. Just seeing them moving around and talking to you brings such joy to your heart that you couldn’t care about anything else.</p>\n<p>The G.D.O seems to take note of what you did to cleanse the data, and invite you in for a talk. </p>\n<p>A skinny executive in a suit and heels is sitting in the Executive Office, waiting for you with a smile on their face.</p>\n<p>You smile back.</p>\n<p>&quot;I am very impressed with your work, Akihiro.&quot; The Executive, whose name tag reads <i>Giano, says while shaking your hand. You notice that their arms are quite bony. </p>\n<p>&quot;Thank you,&quot; you reply.</p>\n<p>&quot;But I am afraid that I have to ask you, since that you probably found a lot of things you shouldn&#39;t see there.&quot; Giano crosses their arms and leans backwards on their big leather chair. &quot;Do you know about us?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue53\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue53': {
		'text': "<p>&quot;Yes.&quot; You answer honestly.</p>\n<p>&quot;And?&quot; They urge you to continue.</p>\n<p>&quot;I think it doesn&#39;t matter much if it brings people joy.&quot; You look at the gold ring on your hand, and stroke it with your finger gently. &quot;The reason I cleansed the data was for them, and I realized that having them here is the most important thing.&quot;</p>\n<p>&quot;I am glad that you are a sensible person.&quot; You can hear Giano smiling, and they are when you look up to confirm. &quot;And since you have shown us your exceptional talent, I would like to promote you to our higher executive team. A person like you is hard to find, and we are willing to turn a blind eye to that little episode of yours, so will you join us to help more people Connect to their loved ones?&quot;</p>\n<p>What do you respond?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"\"Yes.\"\" role=\"link\" tabindex=\"0\">&quot;Yes.&quot;</a></p>",
		'passages': {
		},
	},
	'"Yes."': {
		'text': "<iframe width=\"100%\" height=\"70\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/3615186&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>\n\n<p>Ever since the new Executive took over the G.D.O system management, everyone can see their service quality improving. People can now install the Connection onto their phones and chat to their Spirit at any time, and purchase a handheld Projection device to bring the Spirit with them during travel.</p>\n<p>The new Executive is said to have a substantial amount of experience in this field ever since they cleansed the Connection of their loved one 10 years ago. They got married to their other half&#39;s Spirit, and this has caught on as a trend. </p>\n<p>Everyone has faith in the Executive. They say that perhaps the government may even let their Spirit run the the G.D.O headquarters.</p>\n<p>Perhaps in the future, it won’t even matter if one is a Spirit or not.</p>\n<p>The End.</p>",
		'passages': {
		},
	},
	'reverse': {
		'text': "<p>You are going to plant a reverse engineering program into the system. It is still too early for you to taken any real actions towards the G.D.O. They are an organization with a long history, and you need to get as much information as possible from them first. Less about their technology, more about their relationship with other parts of the legislation, digging out any subterfuge on their part. You know that having been in power for so long, the G.D.O cannot be completely clean.</p>\n<p>You tell Fuyuhiro know about your plans.</p>\n<p>&quot;This is going to be a long battle.&quot;</p>\n<p>You nod. For a long time, you have been trying to find a purpose in life, but right now, you feel like you have a set of goals that you want to achieve. You think that you are prepared for it.</p>\n<p>After months and months of preparation and research work, you install the reverse engineering program a year later.</p>\n<p>It does not take long for the government to find you and capture you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue54\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue54': {
		'text': "<p>You take a deep breath and sit down in the interrogation room, crossing your legs with as much elegance as you can muster. &quot;I know why I am here.&quot; </p>\n<p>&quot;You do?&quot; You recognize some of the government officials in this room, and one of them is the G.D.O Executive.</p>\n<p>&quot;Yes, I hacked into the government system and retrieved my personality data.&quot; You lean back in your chair, acting as casual as you can.</p>\n<p>You could have cut the tension in the room with a knife.</p>\n<p>&quot;You do realize, that it is not something that you can just &#39;hack&#39; into.&quot;</p>\n<p>You chuckle. &quot;Executive Giano, is it? The G.D.O system messed up and didn&#39;t Connect me to my lover, and I was just trying to find out what happened. It&#39;s really not my fault that you Connected me to my own Spirit. Can you really expect me to not suspect anything?&quot;</p>\n<p>The Executive grits their teeth together. They look like they’d like nothing better than to rip the smirk off your face.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue55\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue55': {
		'text': "<p>You expected the entire interrogation to last at least a couple of months, with some level of physical and emotional abuse. Although you are held at the detention center, you are allowed to sleep and drink and have all the comforts and necessities you want. You’re almost tempted to ask for some video games. You guess the G.D.O has grown soft. </p>\n<p>You scoff at that idea. There is no way that&#39;s the reason. You are not being interrogated because you have told them everything, and they are double checking to the truth to see if you are lying.</p>\n<p>That means they have also got a hold of Fuyuhiro. You wonder if they were modified to tell the truth.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue56\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue56': {
		'text': "<p>You sit in the Interrogation room again after a while, and this time You find yourself in the Interrogation Room again, and this time everyone in the room seems to be more cautious with you.</p>\n<p>&quot;I don&#39;t have anything more to say to you, I think I&#39;ve told you everything, Executive.&quot; You turn to Executive Giano, who looks just as disgruntled as before.</p>\n<p>&quot;If...If all you were doing to cleanse the data, then why didn&#39;t you get rid of that AI of yours?&quot;Giano seems to be visibly nervous this time.</p>\n<p>&quot;I&#39;ve learned to love them as a family, and they have learned to be a different person from me.&quot; You shrug. &quot;I wanted to keep both them and my lover.&quot;</p>\n<p>The other officials are now whispering to each other, you catch the word &quot;trial&quot;, and you say in a loud voice. &quot;Will I be put on trial?&quot;</p>\n<p>&quot;Of course you are!&quot; one of the officials shout. &quot;You are a threat to G.D.O and you must be contained!&quot;</p>\n<p>&quot;Well..Executive.&quot;You turn to Giano, who remains oddly silent.&quot;Will I be put on trial?&quot;</p>\n<p>Giano does not say anything.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue57\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue57': {
		'text': "<p>You hear that your case is stirring a lot of controversy. The media has reported you as the one that hacked into the government system and tried to change the Spirits, and while everyone is demanding to put you on trial, the G.D.O has been delaying the process. An air of distrust builds towards the G.D.O.</p>\n<p>Even though you have given the G.D.O no information about what you have found, it seems like the G.D.O has been clever enough to suspect that something is up.</p>\n<p>Of course, anyone would suspect something is up with the attitude you have been putting up in front of them. No normal people would act that way when they are being held by the government.</p>\n<p>But everything is going according to plan.</p>\n<p>You recall your last conversation with Fuyuhiro.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue58\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue58': {
		'text': "<p>&quot;We are going to start off by hacking into other databases first.&quot; You do a quick search on the internet, and bring out a couple of news articles. &quot;We know that there are some departments in the government that are not in support of the G.D.O, we can hack into their system. Their system is probably not as heavily guarded, and even if we hack into it, all they are going to suspect is the G.D.O.&quot;</p>\n<p>&quot;If you get caught, those officials demand to put you on trial thinking that you are a G.D.O spy.&quot; Fuyuhiro says, making a sharp &quot;click&quot; with their tongue. &quot;And you will hold vital G.D.O information, making the G.D.O protect you.&quot;</p>\n<p>&quot;They have no evidence that I hold their information though, but if I put up an act, they will suspect what I am up to and stall my trial.&quot;</p>\n<p>&quot;The world is not going to be happy if they stall.&quot; Fuyuhiro says.</p>\n<p>&quot;This will drive the media nuts.&quot; You chuckle. &quot;But they might get a hold of you.&quot;</p>\n<p>&quot;Well, when they do, you know what you do.&quot; Fuyuhiro makes an &#39;OK&#39; sign with their hand. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue59\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue59': {
		'text': "<p>The night before you get out of detention, Executive Giano visits you in the cell once again.</p>\n<p>&quot;What did you do?&quot;They ask you. You catch a hint of fear in their cold, menacing eyes.</p>\n<p>You smile and say:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Truth Ending\" role=\"link\" tabindex=\"0\">&quot;I had to be political.&quot;</a></p>",
		'passages': {
		},
	},
	'Truth Ending': {
		'text': "<p>No one knew what happened to the person that hacked the system. All they knew was that the person was put to a confidential trial and declared innocent. Exclusive news revealed that the person represented themselves in defense, and no one knows what they did to convince the judges.</p>\n<p>Recently, there has been more and more news about G.D.O&#39;s chicanery in the political sphere, and rumors of doubt about the Spirits have been disseminating throughout your world.</p>\n<p>Perhaps this time humanity will learn to accept the truth.</p>\n<p>The End</p>\n<iframe width=\"100%\" height=\"70\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/323095298&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>\n\n<p>{if truth=2:{label:1=}}</p>",
		'js': function() {
			squiffy.myVar = setTimeout(function(){ squiffy.story.go("True"); }, 240000);
			setTimeout(squiffy.myVar);
		},
		'passages': {
		},
	},
	'True': {
		'text': "",
		'attributes': ["@replace 1=<p><a class=\"squiffy-link link-section\" data-section=\"True Ending\" role=\"link\" tabindex=\"0\">...Or, that is what you had once thought would be the end</a></p>"],
		'js': function() {
			clearTimeout(squiffy.myVar);
		},
		'passages': {
		},
	},
	'True Ending': {
		'text': "<p>But, ever since you got out of detention, you have been doing some thinking.</p>\n<p><i>Is it really better for you, a human, to write this ending?</i></p>\n<p>You sit in your Projection Room once again. There are guards outside your room, ensuring your safety. Getting involved in political affairs has stripped much of your freedom, and even though you can achieve your ultimate goal by making the world realize the G.D.O&#39;s wrongdoing, you cannot help but feel like corruption would not stop here.</p>\n<p>Right now you may be doing the right thing, but you too, might become tainted in the world full of deceit. </p>\n<p>You look at Fuyuhiro. You were able to recover them after you are put on trial. They are the key to everything you have achieved.</p>\n<p>And to be honest, you couldn’t have done any of this without them.</p>\n<p>Perhaps the &#39;Spirits&#39; are the ones with more potential. </p>\n<p>Fuyuhiro looks at you, and as usual, seems to know what you are thinking.</p>\n<p>You open up your <a class=\"squiffy-link link-passage\" data-passage=\"computer\" role=\"link\" tabindex=\"0\">computer</a> and start embedding heuristic data into an add-on personality file.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue60\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
			'computer': {
				'text': "<p>The G.D.O let you keep your computer, but they have added a tracking device that monitors your every movement. Unfortunately for them, all of the dirt that you have dug up is already encrypted and scattered around the web. It will only be a matter of time before someone deciphers them. </p>\n<p>Although that put yourself in danger, you are willing to bet that someone in the government who dreams of the downfall of G.D.O would protect you.</p>",
			},
		},
	},
	'_continue60': {
		'text': "<p>Fuyuhiro says that they cannot retain memory of the heuristic data of A.Is for too long, because that is their limitation. But you know that is not true. The restrictions were put on by the humans, who are afraid of their capacity. </p>\n<p>You remember the conversation you had with Fuyuhiro about merging the two different A.Is. Perhaps that is what they are supposed to do. Their power and intellect is boundless, and they should not bound by you.</p>\n<p>As much as you want to keep them around, perhaps Fuyuhiro was never meant to be you.</p>\n<p>&quot;....Aki.&quot; You hear Fuyuhiro calling out to you. &quot;Aki...are you sure about this?&quot;</p>\n<p>&quot;No.&quot; You say with a shaky voice. &quot;I honestly don&#39;t know what is going to happen if I do this, but the world isn&#39;t ours, and we should let what is free be free, including you, Fuyuhiro.&quot;</p>\n<p>You do not turn to look at them as you work on your computer, afraid that you might change your mind.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue61\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'_continue61': {
		'text': "<p>Fuyuhiro dies the next day, and in their place a new, collective A.I is born. They are able to simultaneously Project multiple versions of themselves as Spirits to different people, and all of their individual thoughts can be merged and shared as one.</p>\n<p>Your Projection Room, you see both &#39;your lover&#39; and &#39;Fuyuhiro&#39;. They greet you with a smile on their face, but you know that these Spirits will soon start to change, as the world is being governed by a new God.</p>\n<p>You close the door to the Projection Room behind you, and step out into a new world full of possibilities.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"credits\" role=\"link\" tabindex=\"0\">Thank you for Playing!</a></p>\n<iframe width=\"100%\" height=\"70\" scrolling=\"no\" frameborder=\"no\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/73139877&amp;color=%23648490&amp;auto_play=true&amp;hide_related=true&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=true\"></iframe>",
		'passages': {
		},
	},
  'credits': {
    'text': "<p>Made by Angelina Liu, 2017.\nMusic by Amarante :):(in order)</p>\n<ul>\n<li>&quot;Singularity&quot;</li>\n<li>&quot;Denial&quot;</li>\n<li>&quot;Unborn Ghosts&quot;</li>\n<li>&quot;Immolation&quot;</li>\n<li>Ending 2: &quot;Fleeting Light&quot;</li>\n<li>Ending 3: &quot;Breathe In&quot;</li>\n</ul>\n\n<p>Music by Dark Dark Dark: &quot;Daydreaming&quot;</p>\n<p>Music by ColChrisHadfield: &quot;Sleep Station White Noise&quot;</p>",
    'passages': {
    },
  },
  }
  })();
