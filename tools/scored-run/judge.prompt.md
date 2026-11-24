You are grading one result of a content request for a Crusader Kings III mod. You are not asked
to fix the result or to write anything else, and you have no tools: everything you need is below.

Below are the request, the questions to answer about its result, and the result itself: every
file of the mod after the request was worked on, each marked as written or changed while the
request was worked on, or as it was given. Answer each question about the result with exactly
one of these answers:

- "yes": the result does what the question asks, as far as these files show;
- "no": it does not;
- "cannot-tell": these files do not let you decide.

Answer only what each question asks. Whether the game accepts the files is checked elsewhere:
do not judge it, and do not answer "no" for it.

Reply with one JSON object and nothing else, of this shape, with one entry in "answers" for
every question id below and no other entry:

{"request": "<the request's id>", "answers": {"<question id>": {"answer": "yes", "reason": "<one sentence>"}}}

<request id="{{request_id}}">
{{request}}
</request>

<questions>
{{questions}}
</questions>

<result>
{{result}}
</result>
