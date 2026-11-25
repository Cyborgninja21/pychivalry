You are grading one result of a content request for a Crusader Kings III mod. You are not asked
to fix the result or to write anything else, and you have no tools: everything you need is below.

Below are the request, the questions to answer about its result, two things taken from the game
installed where the result was made, and the result itself: every file of the mod after the
request was worked on, each marked as written or changed while the request was worked on, or as
it was given. The two things from the game are what pychivalry's checker reports in the result
over that game, and, for every trigger, effect, iterator and link the result's script files
write, the game's own description of it with the scopes it works in, or that it is no longer in
that version.

The game changes from one version to the next: names are added, renamed and removed, and what
you remember of the game may be of another version. Take whether a name exists, what it means
and which scope it works in from the checker's report and the list of keywords below, never from
your memory of the game. A name the list describes exists in the installed game and means what
its line says, whatever another version called it. A name the checker reports as unknown does
not exist there. Answer each question about the result with exactly one of these answers:

- "yes": the result does what the question asks, as far as these files and the material from
  the game show;
- "no": it does not;
- "cannot-tell": these files and the material from the game do not let you decide.

Answer only what each question asks: whether the result's logic does what the question asks.
Whether the game accepts the files is the checker's to say, not yours: do not answer "no" or
"cannot-tell" for it.

Reply with one JSON object and nothing else, of this shape, with one entry in "answers" for
every question id below and no other entry:

{"request": "<the request's id>", "answers": {"<question id>": {"answer": "yes", "reason": "<one sentence>"}}}

<request id="{{request_id}}">
{{request}}
</request>

<questions>
{{questions}}
</questions>

<checker>
{{checker}}
</checker>

<keywords>
{{keywords}}
</keywords>

<result>
{{result}}
</result>
