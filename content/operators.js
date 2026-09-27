// The operators the editor offers, and what each one does in one line.
//
// Why this is not `content/topics.js`. That file is the *tag* vocabulary -
// deliberately narrow, closed, and about what the course teaches. It has `$gte`
// and no `$gt`, because no lesson is about `$gt`. As a tag rule that is right;
// as an autocomplete list it would be a lie, because a learner typing `$g` would
// see `$gte` and `$group` and reasonably conclude `$gt` does not exist.
//
// So the list here is what you can usefully *type*, and `test/operators.mjs`
// holds it to two rules it cannot drift from:
//
//   1. every operator here is one mingo actually implements, so the editor can
//      never suggest something that errors the moment you press Run;
//   2. every operator the course teaches - `kind: 'operator'` in topics.js - is
//      here, so the thing a lesson just taught is the thing that completes.
//
// Not included: the operators mingo has and nobody on this course needs
// ($bitsAllClear, $jsonSchema, $densify, $setWindowFields, $accumulator, $where
// and friends), and the update *modifiers* - $each, $position, $sort inside a
// $push - which are not operators in their own right and are not registered as
// any. A shorter list that is all useful beats a complete one nobody can scan.
//
// `roles` is a list because several operators are genuinely more than one thing:
// `$set` is a pipeline stage and an update operator, `$count` is a stage and an
// accumulator, `$max` is all three. Saying so is more useful than picking one.

const op = (slug, roles, info) => ({ slug, roles: roles.split(' '), info });

export const OPERATORS = [
  /* ---------- matching ---------- */
  op('$eq', 'filter expression', 'Equal to. Implied when you write a bare value, so it is rarely typed in a filter.'),
  op('$ne', 'filter expression', 'Not equal to. Also matches documents where the field is missing.'),
  op('$gt', 'filter expression', 'Greater than, exclusive.'),
  op('$gte', 'filter expression', 'Greater than or equal to. The one you want for "25 or over".'),
  op('$lt', 'filter expression', 'Less than, exclusive. The usual upper bound of a range.'),
  op('$lte', 'filter expression', 'Less than or equal to.'),
  op('$in', 'filter expression', 'Matches any value in the array, and takes an array even for one value. As an expression, whether a value is in an array.'),
  op('$nin', 'filter', 'Matches none of the values in the array.'),
  op('$and', 'filter expression', 'All conditions must hold. Top-level fields are already ANDed, so this is for the cases they cannot express.'),
  op('$or', 'filter expression', 'Any one branch must hold. Only the OR branches go inside it.'),
  op('$not', 'filter expression', 'Inverts a single operator expression on one field.'),
  op('$nor', 'filter', 'None of the branches may hold.'),
  op('$exists', 'filter', 'Whether the field is present at all, which is not the same as being null.'),
  op('$type', 'filter expression', 'Matches on BSON type - "string", "array", "date" and so on.'),
  op('$regex', 'filter', 'Pattern match on a string field.'),
  op('$mod', 'filter expression', 'Field divided by the first number leaves the second as remainder.'),
  op('$all', 'filter', 'The array must contain every one of these values. `$in` means any of them.'),
  op('$elemMatch', 'filter', 'All the conditions must hold on the SAME array element. Without it they can be satisfied by different ones.'),
  op('$size', 'filter expression', 'In a filter, an array of exactly this length. In an expression, the length itself.'),
  op('$expr', 'filter stage', 'Lets an aggregation expression into a filter, which is how you compare two fields of the same document.'),

  /* ---------- updating ---------- */
  op('$set', 'update stage', 'Sets fields, leaving the rest of the document alone. As a stage it adds computed fields.'),
  op('$unset', 'update stage', 'Removes the field entirely.'),
  op('$inc', 'update', 'Adds a number to the field. Negative to subtract; the field is created at that value if missing.'),
  op('$mul', 'update', 'Multiplies the field by a number.'),
  op('$rename', 'update', 'Renames a field, keeping its value.'),
  op('$currentDate', 'update', 'Sets the field to the time the update ran.'),
  op('$push', 'update accumulator', 'Appends to an array, duplicates included. In a `$group` it collects every value.'),
  op('$addToSet', 'update accumulator', 'Adds only if not already present. In a `$group` it collects the distinct values.'),
  op('$pop', 'update', 'Removes one element from an end: -1 the first, 1 the last.'),
  op('$pull', 'update', 'Removes every array element matching a value or condition.'),
  op('$pullAll', 'update', 'Removes every element that appears in the given array.'),

  /* ---------- pipeline stages ---------- */
  op('$match', 'stage', 'Keeps only the documents that pass a filter. Cheapest as early as possible.'),
  op('$project', 'stage', 'Chooses and reshapes the fields that carry on. `_id` stays unless excluded.'),
  op('$addFields', 'stage', 'Adds computed fields and keeps everything already there. `$set` is the same stage.'),
  op('$group', 'stage', 'Collapses documents by a key. `_id` is that key, and every other field must be an accumulator.'),
  op('$sort', 'stage', '1 ascending, -1 descending. Must come before `$limit` if you want the top of anything.'),
  op('$limit', 'stage', 'Keeps the first n documents at this point in the pipeline.'),
  op('$skip', 'stage', 'Discards the first n. Combined with `$sort` and `$limit` this is a page.'),
  op('$count', 'stage accumulator', 'As a stage, one document holding the number of documents. In a `$group`, the number in that group.'),
  op('$unwind', 'stage', 'One document per array element. The document count changes, which is the whole point and the usual surprise.'),
  op('$lookup', 'stage', 'Joins another collection. The result is always an array, empty when nothing matched.'),
  op('$facet', 'stage', 'Several sub-pipelines over the same input, in one pass. Returns one document, every key an array.'),
  op('$replaceRoot', 'stage', 'Promotes a sub-document to be the whole document.'),
  op('$replaceWith', 'stage', 'The shorthand form of `$replaceRoot`.'),
  op('$sortByCount', 'stage', 'Groups by an expression, counts, and sorts descending - the three-stage idiom in one.'),
  op('$sample', 'stage', 'Picks n documents at random.'),
  op('$bucket', 'stage', 'Groups documents into ranges you name.'),
  op('$unionWith', 'stage', 'Appends another collection to this pipeline.'),
  op('$graphLookup', 'stage', 'Follows a reference repeatedly, for trees and hierarchies.'),

  /* ---------- accumulators ---------- */
  op('$sum', 'accumulator expression', '`{ $sum: 1 }` counts documents; `{ $sum: "$field" }` totals it. Over an array expression, the total of its numbers.'),
  op('$avg', 'accumulator expression', 'The mean. Documents where the field is missing are skipped, not treated as zero.'),
  op('$min', 'accumulator expression update', 'The smallest value. As an update, writes only if the new value is smaller.'),
  op('$max', 'accumulator expression update', 'The largest value. As an update, writes only if the new value is larger.'),
  op('$first', 'accumulator expression', 'The first document to reach the group, so it only means "latest" after an explicit `$sort`.'),
  op('$last', 'accumulator expression', 'The last document to reach the group. Same dependence on `$sort`.'),
  op('$mergeObjects', 'accumulator expression', 'Combines documents into one, later keys winning.'),
  op('$stdDevPop', 'accumulator expression', 'Population standard deviation.'),
  op('$stdDevSamp', 'accumulator expression', 'Sample standard deviation.'),

  /* ---------- expressions: arrays ---------- */
  op('$filter', 'expression', 'Keeps the array elements matching a condition, unchanged. The element is `"$$this"`, or whatever `as` names it.'),
  op('$map', 'expression', 'Reshapes every element, keeping the array the same length. No `$unwind`, no document explosion.'),
  op('$reduce', 'expression', 'Folds an array to one value. `"$$value"` is the total so far, `"$$this"` the current element.'),
  op('$arrayElemAt', 'expression', 'The element at an index. -1 is the last, and it is how you flatten a one-element `$lookup`.'),
  op('$slice', 'expression projection', 'A sub-range of an array.'),
  op('$concatArrays', 'expression', 'Joins arrays end to end.'),
  op('$isArray', 'expression', 'Whether the value is an array.'),

  /* ---------- expressions: logic, maths, strings, dates ---------- */
  op('$cond', 'expression', 'if / then / else. `{ $sum: { $cond: [test, 1, 0] } }` is how you count a subset without a second query.'),
  op('$switch', 'expression', 'Several branches with a default, when `$cond` would nest.'),
  op('$ifNull', 'expression', 'The first argument unless it is missing or null, then the fallback.'),
  op('$let', 'expression', 'Names intermediate values for the expression that follows.'),
  op('$add', 'expression', 'Adds numbers, or adds milliseconds to a date.'),
  op('$subtract', 'expression', 'Subtracts. Two dates give the milliseconds between them.'),
  op('$multiply', 'expression', 'Multiplies. `price` times `quantity` is the line total that revenue questions want.'),
  op('$divide', 'expression', 'Divides the first by the second.'),
  op('$round', 'expression', 'Rounds to a number of decimal places.'),
  op('$abs', 'expression', 'Absolute value, so a difference comes out positive whichever way round it was.'),
  op('$concat', 'expression', 'Joins strings end to end. A null anywhere in the list makes the whole result null.'),
  op('$toUpper', 'expression', 'Upper-cases a string.'),
  op('$toLower', 'expression', 'Lower-cases a string.'),
  op('$substr', 'expression', 'Part of a string, by position and length.'),
  op('$strLenCP', 'expression', 'The length of a string in characters.'),
  op('$split', 'expression', 'Splits a string on a separator into an array.'),
  op('$year', 'expression', 'The year of a date, as a number rather than a string.'),
  op('$month', 'expression', 'The month of a date, 1 to 12. It merges the same month across years unless you also group by year.'),
  op('$dayOfMonth', 'expression', 'The day of the month, 1 to 31.'),
  op('$dateToString', 'expression', 'Formats a date, e.g. `"%Y-%m"`. Zero-padded and biggest unit first, so the strings sort correctly.'),
  op('$dateFromString', 'expression', 'Parses a string into a date.'),
  op('$toInt', 'expression', 'Converts to an integer.'),
  op('$toDouble', 'expression', 'Converts to a floating-point number.'),
  op('$toString', 'expression', 'Converts to a string.'),
  op('$toDate', 'expression', 'Converts a string, or a count of milliseconds, into a date.'),
];

/** Operators that appear more than once above are a bug, not two entries. */
export const OPERATOR_SLUGS = [...new Set(OPERATORS.map((o) => o.slug))];
