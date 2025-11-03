const { QueryResult } = require('../../src/utilities');

describe('QueryResult Class', () => {
  let sampleData;
  let queryResult;

  beforeEach(() => {
    sampleData = [
      { key: 'user1', value: { name: 'Alice', age: 30, city: 'New York', score: 85 } },
      { key: 'user2', value: { name: 'Bob', age: 25, city: 'London', score: 92 } },
      { key: 'user3', value: { name: 'Charlie', age: 35, city: 'Paris', score: 78 } },
      { key: 'user4', value: { name: 'Diana', age: 28, city: 'Tokyo', score: 95 } },
      { key: 'user5', value: { name: 'Eve', age: 32, city: 'New York', score: 88 } }
    ];
    queryResult = new QueryResult(sampleData);
  });

  describe('Constructor', () => {
    test('should create QueryResult with provided results', () => {
      expect(queryResult).toBeInstanceOf(QueryResult);
      expect(queryResult.results).toEqual(sampleData);
    });

    test('should create QueryResult with empty array if no results provided', () => {
      const emptyResult = new QueryResult();
      expect(emptyResult.results).toEqual([]);
    });

    test('should create QueryResult with null results', () => {
      const nullResult = new QueryResult(null);
      expect(nullResult.results).toEqual([]);
    });
  });

  describe('Sorting', () => {
    test('should sort by field in ascending order', () => {
      const sorted = queryResult.sort('age', 'asc');

      expect(sorted).toBe(queryResult); // Should return same instance for chaining
      expect(sorted.results[0].value.name).toBe('Bob'); // age 25
      expect(sorted.results[1].value.name).toBe('Diana'); // age 28
      expect(sorted.results[2].value.name).toBe('Alice'); // age 30
      expect(sorted.results[3].value.name).toBe('Eve'); // age 32
      expect(sorted.results[4].value.name).toBe('Charlie'); // age 35
    });

    test('should sort by field in descending order', () => {
      const sorted = queryResult.sort('age', 'desc');

      expect(sorted.results[0].value.name).toBe('Charlie'); // age 35
      expect(sorted.results[1].value.name).toBe('Eve'); // age 32
      expect(sorted.results[2].value.name).toBe('Alice'); // age 30
      expect(sorted.results[3].value.name).toBe('Diana'); // age 28
      expect(sorted.results[4].value.name).toBe('Bob'); // age 25
    });

    test('should sort by field in ascending order by default', () => {
      const sorted = queryResult.sort('age');
      expect(sorted.results[0].value.age).toBe(25);
      expect(sorted.results[4].value.age).toBe(35);
    });

    test('should sort by nested field', () => {
      const nestedData = [
        { key: 'item1', value: { user: { profile: { score: 85 } } } },
        { key: 'item2', value: { user: { profile: { score: 92 } } } },
        { key: 'item3', value: { user: { profile: { score: 78 } } } }
      ];
      const nested = new QueryResult(nestedData);
      const sorted = nested.sort('user.profile.score', 'asc');

      expect(sorted.results[0].value.user.profile.score).toBe(78);
      expect(sorted.results[1].value.user.profile.score).toBe(85);
      expect(sorted.results[2].value.user.profile.score).toBe(92);
    });

    test('should handle sorting with undefined values', () => {
      const dataWithUndefined = [
        { key: 'item1', value: { name: 'Alice', age: 30 } },
        { key: 'item2', value: { name: 'Bob' } }, // no age property
        { key: 'item3', value: { name: 'Charlie', age: 25 } }
      ];
      const result = new QueryResult(dataWithUndefined);
      const sorted = result.sort('age', 'asc');

      expect(sorted.results).toHaveLength(3);
      // Undefined values should be handled gracefully
    });
  });

  describe('Limiting and Skipping', () => {
    test('should limit results', () => {
      const limited = queryResult.limit(3);

      expect(limited).toBe(queryResult); // Should return same instance
      expect(limited.results).toHaveLength(3);
      expect(limited.results[0].key).toBe('user1');
      expect(limited.results[1].key).toBe('user2');
      expect(limited.results[2].key).toBe('user3');
    });

    test('should skip results', () => {
      const skipped = queryResult.skip(2);

      expect(skipped).toBe(queryResult);
      expect(skipped.results).toHaveLength(3);
      expect(skipped.results[0].key).toBe('user3');
      expect(skipped.results[1].key).toBe('user4');
      expect(skipped.results[2].key).toBe('user5');
    });

    test('should chain limit and skip', () => {
      const chained = queryResult.skip(1).limit(2);

      expect(chained.results).toHaveLength(2);
      expect(chained.results[0].key).toBe('user2');
      expect(chained.results[1].key).toBe('user3');
    });

    test('should handle limit larger than available results', () => {
      const limited = queryResult.limit(10);
      expect(limited.results).toHaveLength(5); // Original length
    });

    test('should handle skip larger than available results', () => {
      const skipped = queryResult.skip(10);
      expect(skipped.results).toHaveLength(0);
    });
  });

  describe('Counting and Navigation', () => {
    test('should return correct count', () => {
      expect(queryResult.count()).toBe(5);
    });

    test('should return first result', () => {
      const first = queryResult.first();
      expect(first).toEqual(sampleData[0]);
    });

    test('should return last result', () => {
      const last = queryResult.last();
      expect(last).toEqual(sampleData[4]);
    });

    test('should return undefined for first on empty results', () => {
      const empty = new QueryResult([]);
      expect(empty.first()).toBeUndefined();
    });

    test('should return undefined for last on empty results', () => {
      const empty = new QueryResult([]);
      expect(empty.last()).toBeUndefined();
    });
  });

  describe('Data Extraction', () => {
    test('should return results as array', () => {
      const array = queryResult.toArray();
      expect(array).toEqual(sampleData);
      expect(array).not.toBe(sampleData); // Should be a copy
    });

    test('should extract values only', () => {
      const values = queryResult.values();

      expect(values).toHaveLength(5);
      expect(values[0]).toEqual({ name: 'Alice', age: 30, city: 'New York', score: 85 });
      expect(values[1]).toEqual({ name: 'Bob', age: 25, city: 'London', score: 92 });
    });

    test('should extract keys only', () => {
      const keys = queryResult.keys();

      expect(keys).toEqual(['user1', 'user2', 'user3', 'user4', 'user5']);
    });
  });

  describe('Filtering', () => {
    test('should filter results', () => {
      const filtered = queryResult.filter((value, key) => value.age > 30);

      expect(filtered).toBe(queryResult); // Should return same instance
      expect(filtered.results).toHaveLength(2);
      expect(filtered.results[0].value.name).toBe('Charlie'); // age 35
      expect(filtered.results[1].value.name).toBe('Eve'); // age 32
    });

    test('should filter by key', () => {
      const filtered = queryResult.filter((value, key) => key.includes('user1') || key.includes('user3'));

      expect(filtered.results).toHaveLength(2);
      expect(filtered.results[0].key).toBe('user1');
      expect(filtered.results[1].key).toBe('user3');
    });

    test('should filter by complex conditions', () => {
      const filtered = queryResult.filter((value) =>
        value.city === 'New York' && value.score > 80
      );

      expect(filtered.results).toHaveLength(2);
      expect(filtered.results[0].value.name).toBe('Alice');
      expect(filtered.results[1].value.name).toBe('Eve');
    });

    test('should return empty results when no matches', () => {
      const filtered = queryResult.filter((value) => value.age > 100);
      expect(filtered.results).toHaveLength(0);
    });
  });

  describe('Mapping', () => {
    test('should map results to new values', () => {
      const mapped = queryResult.map((value, key) => ({
        id: key,
        displayName: value.name,
        isAdult: value.age >= 18
      }));

      expect(mapped).toHaveLength(5);
      expect(mapped[0]).toEqual({
        id: 'user1',
        displayName: 'Alice',
        isAdult: true
      });
    });

    test('should map to simple values', () => {
      const names = queryResult.map((value) => value.name);
      expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']);
    });

    test('should access key in mapping function', () => {
      const keyValuePairs = queryResult.map((value, key) => `${key}: ${value.name}`);
      expect(keyValuePairs[0]).toBe('user1: Alice');
    });
  });

  describe('Method Chaining', () => {
    test('should chain multiple operations', () => {
      const result = queryResult
        .filter((value) => value.age >= 28)
        .sort('score', 'desc')
        .limit(2);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].value.name).toBe('Diana'); // highest score among filtered
      expect(result.results[1].value.name).toBe('Eve');   // second highes
    });

    test('should chain with final extraction', () => {
      const names = queryResult
        .filter((value) => value.city === 'New York')
        .sort('age', 'asc')
        .map((value) => value.name);

      expect(names).toEqual(['Alice', 'Eve']);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty data gracefully', () => {
      const empty = new QueryResult([]);

      expect(empty.count()).toBe(0);
      expect(empty.sort('field').results).toHaveLength(0);
      expect(empty.filter(() => true).results).toHaveLength(0);
      expect(empty.limit(5).results).toHaveLength(0);
      expect(empty.skip(2).results).toHaveLength(0);
      expect(empty.values()).toEqual([]);
      expect(empty.keys()).toEqual([]);
      expect(empty.map(x => x)).toEqual([]);
    });

    test('should handle operations on single item', () => {
      const single = new QueryResult([sampleData[0]]);

      expect(single.count()).toBe(1);
      expect(single.first()).toEqual(sampleData[0]);
      expect(single.last()).toEqual(sampleData[0]);
      expect(single.skip(1).results).toHaveLength(0);
    });
  });
});