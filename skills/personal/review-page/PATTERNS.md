# Finding patterns

The user's flags and approvals together show rules they apply but haven't written down. Turn them into candidate rules for the user to accept or reject.

1. **Tally.** Count flags and approvals, by group and by tag.

2. **Draft candidate rules.** Group the flag notes by the mistake they correct, and write each group as one rule with a before and after from the rows. A note that fits no group is a one-off.

3. **Test each rule against the approvals.** Search the approved rows for anything the rule would have changed. An approved row that breaks a rule is a contradiction: show both rows, because either the rule is too broad or the approval was a miss.

4. **Check for clashes.** Read the doc that governs this kind of item, if there is one, and search open issues touching the same content. Note any rule that conflicts with either, and any issue whose copy the rule would change.

5. **Ask.** Call the Skill tool with `grilling`, and put each candidate rule to the user as its own question, with its rows written out and its contradictions and clashes shown. A rule exists only once the user accepts it.

6. **Record accepted rules.** Add them to the doc that governs this kind of item. With no such doc, record them on the issue, or in chat if there's no issue.

Done when every flag note belongs to a candidate rule or is marked a one-off, and the user has answered every candidate.
