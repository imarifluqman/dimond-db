import { IndexQueryMatcher } from '../index/IndexTypes.js';

/**
 * Query Optimizer
 * Analyzes queries and selects optimal execution strategy
 */
export class QueryOptimizer {
    /**
     * @param {Object} indexManager - Index manager instance
     */
    constructor(indexManager) {
        this.indexManager = indexManager;
    }

    /**
     * Optimize a query and generate execution plan
     * @param {Object} filter - Query filter
     * @param {Object} options - Query options (sort, skip, limit)
     * @returns {Object} Execution plan
     */
    optimize(filter, options = {}) {
        // Analyze filter
        const analysis = this.analyzeFilter(filter);

        // Find candidate indexes
        const candidates = this.findIndexCandidates(filter);

        // Score and select best strategy
        const plan = this.selectBestPlan(filter, options, candidates, analysis);

        return plan;
    }

    /**
     * Analyze query filter
     * @param {Object} filter - Query filter
     * @returns {Object} Analysis result
     */
    analyzeFilter(filter) {
        const fields = this.extractQueryFields(filter);
        const operators = this.extractOperators(filter);
        const complexity = this.estimateComplexity(filter);

        return {
            fields,
            operators,
            complexity,
            hasLogicalOperators: operators.some(op => op === '$and' || op === '$or'),
            hasRangeQuery: operators.some(op => ['$gt', '$gte', '$lt', '$lte'].includes(op)),
            hasEqualityQuery: fields.some(field => !this.isOperatorQuery(filter[field]))
        };
    }

    /**
     * Extract fields from filter
     * @param {Object} filter - Query filter
     * @returns {Array<string>} Field names
     */
    extractQueryFields(filter) {
        return IndexQueryMatcher.extractQueryFields(filter);
    }

    /**
     * Extract operators from filter
     * @param {Object} filter - Query filter
     * @returns {Array<string>} Operator names
     */
    extractOperators(filter) {
        const operators = [];

        const extract = (obj) => {
            if (typeof obj !== 'object' || obj === null) {
                return;
            }

            for (const [key, value] of Object.entries(obj)) {
                if (key.startsWith('$')) {
                    operators.push(key);
                }
                if (typeof value === 'object') {
                    extract(value);
                }
            }
        };

        extract(filter);
        return [...new Set(operators)];
    }

    /**
     * Estimate query complexity
     * @param {Object} filter - Query filter
     * @returns {number} Complexity score
     */
    estimateComplexity(filter) {
        let complexity = 0;

        const analyze = (obj, depth = 0) => {
            if (typeof obj !== 'object' || obj === null) {
                return;
            }

            complexity += depth;

            for (const [key, value] of Object.entries(obj)) {
                if (key === '$and' || key === '$or') {
                    complexity += 5;
                    if (Array.isArray(value)) {
                        value.forEach(v => analyze(v, depth + 1));
                    }
                } else if (key.startsWith('$')) {
                    complexity += 1;
                } else {
                    complexity += 1;
                    analyze(value, depth + 1);
                }
            }
        };

        analyze(filter);
        return complexity;
    }

    /**
     * Find candidate indexes for a query
     * @param {Object} filter - Query filter
     * @returns {Array} Candidate indexes with scores
     */
    findIndexCandidates(filter) {
        if (!this.indexManager) {
            return [];
        }

        const candidates = [];

        for (const [name, index] of this.indexManager.indexes.entries()) {
            const match = IndexQueryMatcher.canUseIndex(filter, index.definition);

            if (match.match) {
                candidates.push({
                    name,
                    index,
                    score: match.score,
                    definition: index.definition
                });
            }
        }

        // Sort by score (descending)
        candidates.sort((a, b) => b.score - a.score);

        return candidates;
    }

    /**
     * Select best execution plan
     * @param {Object} filter - Query filter
     * @param {Object} options - Query options
     * @param {Array} candidates - Index candidates
     * @param {Object} analysis - Filter analysis
     * @returns {Object} Execution plan
     */
    selectBestPlan(filter, options, candidates, analysis) {
        // No indexes available
        if (candidates.length === 0) {
            return {
                strategy: 'COLLECTION_SCAN',
                reason: 'No suitable index available',
                estimatedCost: 1000,
                filter,
                options
            };
        }

        const bestCandidate = candidates[0];

        // High-score index available
        if (bestCandidate.score >= 80) {
            return {
                strategy: 'INDEX_SCAN',
                indexName: bestCandidate.name,
                indexType: bestCandidate.definition.type,
                score: bestCandidate.score,
                estimatedCost: 10,
                filter,
                options
            };
        }

        // Medium-score index
        if (bestCandidate.score >= 50) {
            return {
                strategy: 'INDEX_SCAN_WITH_FILTER',
                indexName: bestCandidate.name,
                indexType: bestCandidate.definition.type,
                score: bestCandidate.score,
                estimatedCost: 50,
                reason: 'Index covers partial query, additional filtering needed',
                filter,
                options
            };
        }

        // Low-score index - might still be better than full scan
        if (bestCandidate.score >= 30 && analysis.complexity > 5) {
            return {
                strategy: 'INDEX_SCAN_WITH_FILTER',
                indexName: bestCandidate.name,
                indexType: bestCandidate.definition.type,
                score: bestCandidate.score,
                estimatedCost: 100,
                reason: 'Complex query benefits from partial index coverage',
                filter,
                options
            };
        }

        // Fall back to collection scan
        return {
            strategy: 'COLLECTION_SCAN',
            reason: 'Index score too low, full scan more efficient',
            estimatedCost: 1000,
            filter,
            options
        };
    }

    /**
     * Check if field query uses operators
     * @param {*} fieldQuery - Field query
     * @returns {boolean} True if uses operators
     */
    isOperatorQuery(fieldQuery) {
        return typeof fieldQuery === 'object' &&
            fieldQuery !== null &&
            !Array.isArray(fieldQuery) &&
            Object.keys(fieldQuery).some(k => k.startsWith('$'));
    }

    /**
     * Explain query execution
     * @param {Object} filter - Query filter
     * @param {Object} options - Query options
     * @returns {Object} Execution explanation
     */
    explain(filter, options = {}) {
        const analysis = this.analyzeFilter(filter);
        const candidates = this.findIndexCandidates(filter);
        const plan = this.selectBestPlan(filter, options, candidates, analysis);

        return {
            query: filter,
            options,
            analysis,
            indexCandidates: candidates.map(c => ({
                name: c.name,
                score: c.score,
                fields: c.definition.fields,
                type: c.definition.type
            })),
            selectedPlan: plan,
            recommendations: this.generateRecommendations(analysis, candidates, plan)
        };
    }

    /**
     * Generate query optimization recommendations
     * @param {Object} analysis - Filter analysis
     * @param {Array} candidates - Index candidates
     * @param {Object} plan - Selected plan
     * @returns {Array<string>} Recommendations
     */
    generateRecommendations(analysis, candidates, plan) {
        const recommendations = [];

        // No index available
        if (candidates.length === 0 && analysis.fields.length > 0) {
            recommendations.push(
                `Consider creating an index on: ${analysis.fields.join(', ')}`
            );
        }

        // Collection scan on complex query
        if (plan.strategy === 'COLLECTION_SCAN' && analysis.complexity > 10) {
            recommendations.push(
                'Complex query using collection scan - performance may be slow'
            );
        }

        // Partial index coverage
        if (plan.strategy === 'INDEX_SCAN_WITH_FILTER') {
            recommendations.push(
                'Index covers only part of the query - consider compound index'
            );
        }

        // Range query without BTree
        if (analysis.hasRangeQuery && candidates.length > 0) {
            const btreeIndex = candidates.find(c => c.definition.type === 'btree');
            if (!btreeIndex) {
                recommendations.push(
                    'Range query detected - BTree index recommended for better performance'
                );
            }
        }

        // Logical operators
        if (analysis.hasLogicalOperators) {
            recommendations.push(
                'Query uses logical operators ($and/$or) - ensure indexes cover all branches'
            );
        }

        return recommendations;
    }
}
