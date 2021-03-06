/**
 * External dependencies
 */
import { get, isString, kebabCase, reduce, upperFirst } from 'lodash';

/**
 * WordPress dependencies
 */
import { Component } from '@wordpress/element';
import { withSelect } from '@wordpress/data';
import { compose, createHigherOrderComponent } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { getColorClassName, getColorObjectByColorValue, getColorObjectByAttributeValues, getMostReadableColor } from './utils';

const DEFAULT_COLORS = [];

/**
 * Higher-order component, which handles color logic for class generation
 * color value, retrieval and color attribute setting.
 *
 * @param {...(object|string)} args The arguments can be strings or objects. If the argument is an object,
 *                                  it should contain the color attribute name as key and the color context as value.
 *                                  If the argument is a string the value should be the color attribute name,
 *                                  the color context is computed by applying a kebab case transform to the value.
 *                                  Color context represents the context/place where the color is going to be used.
 *                                  The class name of the color is generated using 'has' followed by the color name
 *                                  and ending with the color context all in kebab case e.g: has-green-background-color.
 *
 *
 * @return {Function} Higher-order component.
 */
export default ( ...args ) => {
	const colorMap = reduce( args, ( colorObject, arg ) => {
		return {
			...colorObject,
			...( isString( arg ) ? { [ arg ]: kebabCase( arg ) } : arg ),
		};
	}, {} );

	return createHigherOrderComponent(
		compose( [
			withSelect( ( select ) => {
				const settings = select( 'core/editor' ).getEditorSettings();
				return {
					colors: get( settings, [ 'colors' ], DEFAULT_COLORS ),
				};
			} ),
			( WrappedComponent ) => {
				return class extends Component {
					constructor( props ) {
						super( props );

						this.setters = this.createSetters();
						this.colorUtils = {
							getMostReadableColor: this.getMostReadableColor.bind( this ),
						};

						this.state = {};
					}

					getMostReadableColor( colorValue ) {
						const { colors } = this.props;
						return getMostReadableColor( colors, colorValue );
					}

					createSetters() {
						return reduce( colorMap, ( settersAccumulator, colorContext, colorAttributeName ) => {
							const upperFirstColorAttributeName = upperFirst( colorAttributeName );
							const customColorAttributeName = `custom${ upperFirstColorAttributeName }`;
							settersAccumulator[ `set${ upperFirstColorAttributeName }` ] =
								this.createSetColor( colorAttributeName, customColorAttributeName );
							return settersAccumulator;
						}, {} );
					}

					createSetColor( colorAttributeName, customColorAttributeName ) {
						return ( colorValue ) => {
							const colorObject = getColorObjectByColorValue( this.props.colors, colorValue );
							this.props.setAttributes( {
								[ colorAttributeName ]: colorObject && colorObject.slug ? colorObject.slug : undefined,
								[ customColorAttributeName ]: colorObject && colorObject.slug ? undefined : colorValue,
							} );
						};
					}

					static getDerivedStateFromProps( { attributes, colors }, previousState ) {
						return reduce( colorMap, ( newState, colorContext, colorAttributeName ) => {
							const colorObject = getColorObjectByAttributeValues(
								colors,
								attributes[ colorAttributeName ],
								attributes[ `custom${ upperFirst( colorAttributeName ) }` ],
							);

							const previousColorObject = previousState[ colorAttributeName ];
							const previousColor = get( previousColorObject, [ 'color' ] );
							/**
							* The "and previousColorObject" condition checks that a previous color object was already computed.
							* At the start previousColorObject and colorValue are both equal to undefined
							* bus as previousColorObject does not exist we should compute the object.
							*/
							if ( previousColor === colorObject.color && previousColorObject ) {
								newState[ colorAttributeName ] = previousColorObject;
							} else {
								newState[ colorAttributeName ] = {
									...colorObject,
									class: getColorClassName( colorContext, colorObject.slug ),
								};
							}
							return newState;
						}, {} );
					}

					render() {
						return (
							<WrappedComponent
								{ ...{
									...this.props,
									colors: undefined,
									...this.state,
									...this.setters,
									colorUtils: this.colorUtils,
								} }
							/>
						);
					}
				};
			},
		] ),
		'withColors'
	);
};
